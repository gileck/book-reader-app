import { NextApiRequest } from 'next';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '@/apis/auth/types';
import { findUserById } from './database/collections/users/users';

const JWT_SECRET = process.env.JWT_SECRET || 'xxxxx';
const COOKIE_NAME = 'auth_token';

export async function getUserFromRequest(req: NextApiRequest) {
    // Development mode bypass
    if (process.env.NODE_ENV === 'development' && process.env.LOCAL_USER_ID) {
        const user = await findUserById(process.env.LOCAL_USER_ID);
        return user ? {
            _id: user._id.toString(),
            username: user.username,
            email: user.email,
            id: user._id.toString()
        } : null;
    }

    // Parse cookies
    const cookies = parse(req.headers.cookie || '');
    const token = cookies[COOKIE_NAME];

    if (!token) {
        return null;
    }

    try {
        // Verify and decode the token
        const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
        const user = await findUserById(decoded.userId);
        
        return user ? {
            _id: user._id.toString(),
            username: user.username,
            email: user.email,
            id: user._id.toString()
        } : null;
    } catch (err) {
        console.warn('Invalid auth token:', err);
        return null;
    }
}

