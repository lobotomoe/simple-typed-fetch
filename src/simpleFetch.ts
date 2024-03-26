/* eslint-disable @typescript-eslint/naming-convention */
import {type z} from 'zod';
import type {Schema} from 'zod';
import fetchWithValidation from './fetchWithValidation.js';

// https://stackoverflow.com/a/64919133
class Wrapper<DataOut, DataIn, ErrorOut, ErrorIn> {
	async wrapped(
		url: string,
		schema: Schema<DataOut, z.ZodTypeDef, DataIn>,
		options?: RequestInit,
		errorSchema?: Schema<ErrorOut, z.ZodTypeDef, ErrorIn>,
	) {
		return fetchWithValidation<DataOut, DataIn, ErrorOut, ErrorIn>(url, schema, options, errorSchema);
	}
}

export type FetchWithValidationType<O, I, EO, EI> = ReturnType<Wrapper<O, I, EO, EI>['wrapped']>;

export default function simpleFetch<O, I, EO, EI, P extends unknown[]>(
	f: (...params: P) => FetchWithValidationType<O, I, EO, EI>,
) {
	return async (...params: Parameters<typeof f>) => {
		const result = await f(...params);
		if (result.isErr()) {
			const {message, url} = result.error;
			throw new Error(`${message} (${url})`);
		}

		return result.value.data;
	};
}

// async function test() {
// 	await simpleFetch(
// 		async () =>
// 			fetchWithValidation(
// 				'',
// 				z.object({
// 					messageId: z.number().int(),
// 				}),
// 				undefined,
// 				z.object({
// 					message: z.string(),
// 				}),
// 			),
// 	)();
// }
