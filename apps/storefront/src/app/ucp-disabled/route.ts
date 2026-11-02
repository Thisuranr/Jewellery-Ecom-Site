// Every UCP (AI-agent checkout) URL is rewritten here while UCP_ENABLED is not "true"
// (see next.config.js), so they all answer 404.
export const GET = () => new Response("Not found", { status: 404 })
export const POST = GET
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
