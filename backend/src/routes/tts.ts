import { Router } from 'express';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId,
} from '@aws-sdk/client-polly';

const router = Router();
const polly = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });

router.post('/', async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 500) {
    res.status(400).json({ error: 'Invalid text' });
    return;
  }

  try {
    const command = new SynthesizeSpeechCommand({
      Text: text.trim(),
      OutputFormat: OutputFormat.MP3,
      VoiceId: VoiceId.Stephen,
      Engine: Engine.NEURAL,
    });

    const response = await polly.send(command);

    if (!response.AudioStream) {
      res.status(500).json({ error: 'No audio returned from Polly' });
      return;
    }

    // Collect stream chunks into a Buffer, encode as base64
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.AudioStream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const audio = buffer.toString('base64');

    res.json({ audio });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Polly TTS error:', err);
    // Surface the AWS reason in non-prod so local IAM issues are obvious
    const detail = process.env.STAGE === 'prod' ? 'TTS synthesis failed' : `TTS synthesis failed: ${message}`;
    res.status(500).json({ error: detail });
  }
});

export default router;
