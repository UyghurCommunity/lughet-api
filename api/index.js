import { handleRequest } from '../src/api.js';
export function GET(request) { return handleRequest(request); }
export const HEAD = GET;
export const OPTIONS = GET;
export function POST(request) { return handleRequest(request); }
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
