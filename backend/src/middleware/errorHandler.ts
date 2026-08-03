import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.name === 'ResourceNotFoundException' || err.message?.includes('not found')) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  if (err.$metadata?.httpStatusCode) {
    res.status(502).json({ error: 'Database error', details: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
