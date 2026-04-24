import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';

interface RequestContext {
	requestId: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export const logger = pino({
	level: process.env.LOG_LEVEL ?? 'info',
	mixin() {
		const ctx = als.getStore();
		return ctx ? { requestId: ctx.requestId } : {};
	}
});

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
	return als.run({ requestId }, fn);
}
