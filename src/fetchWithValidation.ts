import type {Schema, z} from 'zod';

import {err, fromPromise, fromThrowable, ok} from 'neverthrow';

export default async function fetchWithValidation<
	DataOut,
	DataIn,
	ErrorOut,
	ErrorIn,
>(
	url: string,
	schema: Schema<DataOut, z.ZodTypeDef, DataIn>,
	options?: RequestInit,
	errorSchema?: Schema<ErrorOut, z.ZodTypeDef, ErrorIn>,
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

	const fetchResult = await fromPromise(fetch(url, requestOptions), e => {
		if (e instanceof Error) {
			return err({
				requestOptions,
				response: undefined,
				type: 'fetchError' as const,
				url,
				message: e.message,
				error: e,
			});
		}

		return err({
			requestOptions,
			response: undefined,
			type: 'unknownFetchThrow' as const,
			url,
			message: 'Unknown fetch error',
			error: e,
		});
	});

	if (fetchResult.isErr()) {
		return fetchResult.error;
	}

	const response = fetchResult.value;
	const sharedData = {
		requestOptions,
		response,
		url,
	} as const;

	const textResult = await fromPromise(response.text(), e => {
		if (e instanceof Error) {
			return err({
				...sharedData,
				type: 'unknownGetTextError' as const,
				message: `Can't get response content: ${e.message}`,
				error: e,
			});
		}

		return err({
			...sharedData,
			type: 'unknownGetTextUnknownError' as const,
			message: 'Can\'t get response content: unknown error',
			error: e,
		});
	});

	if (textResult.isErr()) {
		return textResult.error;
	}

	const text = textResult.value;
	const sharedDataWithText = {
		...sharedData,
		text,
	} as const;

	if (response.status >= 500) {
		// Server error
		return err({
			...sharedDataWithText,
			type: 'serverError' as const,
			message: `Server error: ${response.status} ${response.statusText}`,
			// status: response.status,
		});
	}

	const safeParseJson = fromThrowable(JSON.parse, e => {
		if (e instanceof Error) {
			return err({
				...sharedDataWithText,
				type: 'jsonParseError' as const,
				message: e.message,
				error: e,
			});
		}

		return err({
			...sharedDataWithText,
			type: 'jsonParseUnknownError' as const,
			message: 'Unknown JSON parse error',
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
				response,
				data: textPayload.data,
			}); // Payload is text
		}

		jsonResult.error.error.message = `Can't parse response as JSON: ${jsonResult.error.error.message}. Original response: ${text}`;
		return jsonResult.error;
	}

	const json: unknown = jsonResult.value;

	if (response.status >= 400) {
		// Client error
		if (errorSchema) {
			const serverError = errorSchema.safeParse(json);
			if (serverError.success) {
				return err({
					...sharedDataWithText,
					type: 'clientErrorWithResponsePayload' as const,
					message: `Client error: ${response.status} ${
						response.statusText
					}. Server error: ${JSON.stringify(serverError.data)}`,
					// status: response.status,
					payload: serverError.data,
				});
			}

			return err({
				...sharedDataWithText,
				type: 'clientErrorPayloadParseError' as const,
				message: 'Can\'t recognize error message. Response: ' + text,
				// status: response.status,
				error: serverError.error,
			});
		}

		return err({
			...sharedDataWithText,
			type: 'clientError' as const,
			message: `Error: ${response.status} ${response.statusText}. Response: ${text}`,
			// status: response.status,
		});
	}

	const payload = schema.safeParse(json);
	if (!payload.success) {
		const issuesMessages = payload.error.issues
			.map(issue => `[${issue.path.join('.')}]  ${issue.message}`)
			.join(', ');
		return err({
			...sharedDataWithText,
			type: 'payloadParseError' as const,
			message: `Can't recognize response payload: ${issuesMessages}`,
			error: payload.error,
		});
	}

	return ok({
		...sharedDataWithText,
		data: payload.data,
	});
}
