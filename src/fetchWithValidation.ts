import type { Schema, z } from "zod";

import { err, fromPromise, fromThrowable, ok } from "neverthrow";

export default async function fetchWithValidation<
  DataOut,
  DataIn,
  ErrorOut,
  ErrorIn
>(
  url: string,
  schema: Schema<DataOut, z.ZodTypeDef, DataIn>,
  options?: RequestInit,
  errorSchema?: Schema<ErrorOut, z.ZodTypeDef, ErrorIn>
) {
  // Cases:
  // fetchError (no network, connection refused, connection break)
  // unknownFetchThrow
  // unknownGetTextError
  // unknownGetTextUnknownError
  // serverError
  // jsonParseError
  // jsonParseUnknownError
  // clientErrorWithResponsePayload
  // clientErrorPayloadParseError
  // clientError
  // payloadParseError
  // payload]

  const requestOptions = {
    ...options,
    headers: options?.headers ?? {},
  };

  const sharedData = {
    requestOptions,
    url,
  };
  const fetchResult = await fromPromise(fetch(url, requestOptions), (e) => {
    if (e instanceof Error) {
      return err({
        type: "fetchError" as const,
        ...sharedData,
        message: e.message,
        error: e,
      });
    }

    return err({
      type: "unknownFetchThrow" as const,
      ...sharedData,
      message: "Unknown fetch error",
      error: e,
    });
  });

  if (fetchResult.isErr()) {
    return fetchResult.error;
  }

  const response = fetchResult.value;
  const sharedDataWithResponse = {
    ...sharedData,
    response,
  };

  const textResult = await fromPromise(response.text(), (e) => {
    if (e instanceof Error) {
      return err({
        type: "unknownGetTextError" as const,
        ...sharedDataWithResponse,
        message: `Can't get response content: ${e.message}`,
        error: e,
      });
    }

    return err({
      type: "unknownGetTextUnknownError" as const,
      ...sharedDataWithResponse,
      message: "Can't get response content: unknown error",
      error: e,
    });
  });

  if (textResult.isErr()) {
    return textResult.error;
  }

  const text = textResult.value;
  const sharedDataWithText = {
    ...sharedDataWithResponse,
    text,
  };

  const safeParseJson = fromThrowable(JSON.parse, (e) => {
    if (e instanceof Error) {
      return err({
        type: "jsonParseError" as const,
        ...sharedDataWithText,
        message: e.message,
        error: e,
      });
    }

    return err({
      type: "jsonParseUnknownError" as const,
      ...sharedDataWithText,
      message: "Unknown JSON parse error",
      error: e,
    });
  });

  const jsonResult = safeParseJson(text);

  if (jsonResult.isErr()) {
    // Try to parse as text
    const textPayload = schema.safeParse(text);
    if (textPayload.success) {
      return ok({
        ...sharedDataWithText,
        data: textPayload.data,
      }); // Payload is text
    }

    return err({
      type: "jsonParseError" as const,
      ...sharedDataWithText,
      message: `Can't parse response as JSON: ${jsonResult.error.error.message}. Original response: ${text}`,
      error: jsonResult.error.error,
    });
  }

  const json: unknown = jsonResult.value;

  let errorMetadata: ErrorOut | undefined;

  if (errorSchema) {
    const serverError = errorSchema.safeParse(json);
    if (serverError.success) {
      errorMetadata = serverError.data;
    }
  }

  if (response.status >= 500) {
    // Server error
    return err({
      type: "serverError" as const,
      ...sharedDataWithText,
      message: `Server error: ${response.status} ${response.statusText}. ${
        errorMetadata ? `Data: ${JSON.stringify(errorMetadata)}` : ""
      }`,
    });
  }

  if (response.status >= 400) {
    return err({
      type: "clientError" as const,
      ...sharedDataWithText,
      message: `Error: ${response.status} ${response.statusText}. Original response: ${text}`,
      errorMetadata,
    });
  }

  const payload = schema.safeParse(json);
  if (!payload.success) {
    const issuesMessages = payload.error.issues
      .map((issue) => `[${issue.path.join(".")}]  ${issue.message}`)
      .join(", ");

    return err({
      type: "payloadParseError" as const,
      ...sharedDataWithText,
      message: `Can't recognize response payload: ${issuesMessages}. Original response: ${text}`,
    });
  }

  return ok({
    ...sharedDataWithText,
    data: payload.data,
  });
}
