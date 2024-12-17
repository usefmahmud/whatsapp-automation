import { makeWASocket, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'
import { Blob } from 'node:buffer'

import 'dotenv/config'
import fs from 'fs'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

const wtt_words = {
    imageMessage: 'photo',
    videoMessage: 'video',
    audioMessage: 'audio',
    documentMessage: 'document'
}

let COUNTER, COUNTER_FILE = 'counter.json'
const data = fs.readFileSync(COUNTER_FILE, 'utf-8');
COUNTER = JSON.parse(data).counter;

const counterIncrement = () => {
    COUNTER++;
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter: COUNTER }));
}

const sendToTelegramText = async msg => {
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: 'html'
        })
    }).then(res => res.json())
      .then(data => console.log(data.ok ? 'Message sent successfully!' : `Failed to send: ${data.description}`))
      .catch(err => console.error('Telegram Text Error:', err))
}

const sendToTelegramMedia = async (fileBuffer, mediaType, caption) => {
    const formData = new FormData()
    const blob = new Blob([fileBuffer])

    let endpoint, filename = ''
    switch(mediaType){
        case 'photo':
            filename = filename || 'file.jpg'
            endpoint = 'sendPhoto'
            formData.append('photo', blob, filename)
            break
        case 'video':
            filename = filename || 'file.mp4'
            endpoint = 'sendVideo'
            formData.append('video', blob, filename)
            break
        case 'audio':
            filename = filename || 'file.ogg'
            endpoint = 'sendAudio'
            formData.append('audio', blob, filename)
            break
        case 'document':
            filename = filename || 'file.pdf'
            endpoint = 'sendDocument'
            formData.append('document', blob, filename)
            break
        default:
            console.error('Unsupported media type:', mediaType)
            return
    }

    formData.append('chat_id', TELEGRAM_CHAT_ID)
    formData.append('parse_mode', 'html')
    if(caption) formData.append('caption', caption)

    try {
        const response = await fetch(`${TELEGRAM_API_URL}/${endpoint}`, { method: 'POST', body: formData })
        const data = await response.json()
        console.log(data.ok ? 'Message sent successfully!' : `Failed to send: ${data.description}`)
    } catch (err) {
        console.error('Telegram Media Error:', err)
    }
}

const startWhatsApp = async () => {
    let { state, saveCreds } = await useMultiFileAuthState('auth_info')
    let sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        if (update.qr) console.log('QR to scan:', update.qr)
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        let msg = messages[0]

        if(msg.key.fromMe) return

        let msgSender = msg.pushName || msg.key.remoteJid
        let messageType = Object.keys(msg.message)[0]

        counterIncrement()
        const telegramMessage = `
            <b>${COUNTER}</b>\n<b>New WhatsApp Message</b>:\n\n<b>From</b>: ${msgSender}\n<b>Message</b>:\n
        `
        if(['extendedTextMessage', 'conversation'].includes(messageType)){
            const msgText = msg.message?.conversation || msg.message?.extendedTextMessage?.text

            await sendToTelegramText(telegramMessage + msgText)
        }

        if(['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(messageType)){
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage })

            await sendToTelegramMedia(
                buffer,
                wtt_words[messageType],
                telegramMessage + (
                    msg.message.imageMessage?.caption ||
                    msg.message.videoMessage?.caption ||
                    msg.message.audioMessage?.caption ||
                    msg.message.documentMessage?.caption ||
                    '<b>NO CAPTION</b>'
                )
            )
        }
    })

    console.log('WhatsApp listener is running. Waiting for messages...')
}

startWhatsApp().catch(err => {
    console.error('Error starting WhatsApp listener:', err)
})
