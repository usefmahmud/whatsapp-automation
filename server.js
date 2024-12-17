import {makeWASocket, useMultiFileAuthState} from '@whiskeysockets/baileys'
import fetch from 'node-fetch'
import 'dotenv/config'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

const sendToTelegram = async msg => {
    await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: 'html'
        })
    }).then(async res => {
        let data = await res.json()
        
        if(data.ok){
            console.log('Message sent successfully!')
        }else{
            console.error('Failed to send message', data.description)
        }
    }).catch(async err => {
        console.error('Error sending message to Telegram:', await err)
    })
}

const startWhatsApp = async () => {
    let {state, saveCreds} = await useMultiFileAuthState('auth_info')
    let sock = makeWASocket({
        auth: state
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        if(update.qr){
            console.log('QR to scan:', update.qr)
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        let msg = messages[0]

        if(msg.key.fromMe) return

        let msgSender = msg.pushName || msg.key.remoteJid
        let msgText = msg.message?.conversation || msg.message?.extendedTextMessage?.text

        if(msgText){
            console.log(`New message from ${msgSender}: ${msgText}`)

            let telegramMessage = `
                <b>New WhatsApp Message</b>:\n\n<b>From</b>: ${msgSender}\n<b>Message</b>:\n${msgText}
            `
            await sendToTelegram(telegramMessage)
        }
    })

    console.log('WhatsApp listener is running. Waiting for messages...')
}

startWhatsApp().catch((err) => {
    console.error('Error starting WhatsApp listener:', err)
})
