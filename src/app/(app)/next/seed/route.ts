export const maxDuration = 300

export async function POST(): Promise<Response> {
  return new Response('Seeding is disabled for this project.', { status: 410 })
}
