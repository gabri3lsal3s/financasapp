/*
  Usage:
    ASSISTANT_BRIDGE_URL="https://<project-ref>.supabase.co/functions/v1/assistant-bridge" \
    ASSISTANT_ACCESS_TOKEN="<user_access_token>" \
    node scripts/assistant-bridge-smoke.mjs
*/

const bridgeUrl = process.env.ASSISTANT_BRIDGE_URL
const accessToken = process.env.ASSISTANT_ACCESS_TOKEN

if (!bridgeUrl || !accessToken) {
  console.error('Missing ASSISTANT_BRIDGE_URL or ASSISTANT_ACCESS_TOKEN')
  process.exit(1)
}

const deviceId = `smoke-${Date.now()}`

const postTurn = async (payload) => {
  const response = await fetch(bridgeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const json = await response.json()
  return { status: response.status, body: json }
}

const run = async () => {
  console.log('1) interpret...')
  const interpret = await postTurn({
    turnType: 'interpret',
    deviceId,
    locale: 'pt-BR',
    text: 'Adicione uma despesa de almoço 10,40',
  })
  console.log(JSON.stringify(interpret, null, 2))

  if (!interpret.body?.commandId) {
    throw new Error('No commandId returned on interpret')
  }

  if (interpret.body.requiresConfirmation) {
    console.log('2) confirm...')
    const confirm = await postTurn({
      turnType: 'confirm',
      deviceId,
      commandId: interpret.body.commandId,
      confirmed: true,
      spokenText: 'confirmar',
    })
    console.log(JSON.stringify(confirm, null, 2))
  }

  console.log('3) insights...')
  const insights = await postTurn({
    turnType: 'insights',
    deviceId,
    month: new Date().toISOString().slice(0, 7),
  })
  console.log(JSON.stringify(insights, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
