import { NextFunction, Request, Response } from 'express';
export function bullBoardAuthMiddleware(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      return res.sendStatus(401);
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [inputUsername, inputPassword] = credentials.split(':');

    if (inputUsername === username && inputPassword === password) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    return res.sendStatus(401);
  };
}
