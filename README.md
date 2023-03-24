# Simple Typed Fetch

This package provides utility functions for making HTTP requests with validation using the zod schema validation library. It handles various error cases, client and server errors, and offers an additional simpleFetch wrapper function for easier usage.

To install the required dependencies for this package, run:

`npm install simple-typed-fetch`

## Usage

### fetchWithValidation

The `fetchWithValidation` function is an async function that takes the following parameters:

- `url` (string): The URL to fetch data from.
- `schema` (Schema): The zod schema for validating the response data.
- `options` (RequestInit, optional): Optional fetch options (like method, headers, etc.).
- `errorSchema` (Schema, optional): The zod schema for validating error responses (4xx status codes).
  The function returns a `Result` object from the `neverthrow` library, which can be either an `Ok` or an `Err` variant. If the response is successfully validated, the function returns an `Ok` variant with the validated data. In case of an error, it returns an `Err` variant with error details.

### simpleFetch

The `simpleFetch` function is a higher-order function that wraps the `fetchWithValidation` function and automatically throws an error in case of an `Err` result. This function is useful when you prefer working with exceptions rather than `Result` objects.

## Error Handling

This package uses the `neverthrow` library for error handling. It provides a detailed error object in case of an error, containing the following properties:

- `type` (string): A string describing the error type.
- `url` (string): The URL where the error occurred.
- `message` (string): A human-readable error message.
- `status` (number, optional): The HTTP status code of the response (for 4xx and 5xx status codes).
- `error` (Error, optional): The original error object (for some error cases).
- `text` (string, optional): The response text (for some error cases).

# Examples

Here's an example of how to use the `fetchWithValidation` function with a zod schema:

```typescript
import { z } from "zod";
import { fetchWithValidation } from "simple-typed-fetch";

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

async function fetchUser(userId: number) {
  const result = await fetchWithValidation(
    `https://api.example.com/users/${userId}`,
    userSchema
  );

  if (result.isErr()) {
    console.error("Error fetching user:", result.error.message);
    return;
  }

  console.log("Fetched user:", result.value);
}
```

And here's an example of how to use the `simpleFetch` function:

```typescript
import { z } from "zod";
import { simpleFetch } from "simple-typed-fetch";

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const fetchUser = simpleFetch(async (userId: number) =>
  fetchWithValidation(`https://api.example.com/users/${userId}`, userSchema)
);

(async () => {
  try {
    const user = await fetchUser(1);
    console.log("Fetched user:", user);
  } catch (error) {
    console.error("Error fetching user:", error.message);
  }
})();
```
