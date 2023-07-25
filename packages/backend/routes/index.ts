import prisma from '../prisma/client';
import axios from 'axios';
import express from 'express';
import cors from 'cors';

import crmRouter from './v1/crm';
import config from '../config';
import revertAuthMiddleware from '../helpers/authMiddleware';
import connectionRouter from './v1/connection';
import { register } from '../generated/typescript';
import { metadataService } from '../services/metadata';
import { accountService } from '../services/Internal/account';

import AuthService from '../services/auth';
import logError from '../helpers/logError';
import verifyRevertWebhook from '../helpers/verifyRevertWebhook';
import { leadService } from './v1/crm/lead';
import { dealService } from './v1/crm/deal';
import { noteService } from './v1/crm/note';
import { companyService } from './v1/crm/company';
import { contactService } from './v1/crm/contact';
import { eventService } from './v1/crm/event';
import { taskService } from './v1/crm/task';
import { userService } from './v1/crm/user';

const router = express.Router();

router.get('/health-check', (_, response) => {
    response.send({
        status: 'ok',
    });
});

router.get('/', (_, response) => {
    response.send({
        status: 'nothing to see here.',
    });
});

router.get('/debug-sentry', () => {
    throw new Error('My first Sentry error!');
});

router.post('/debug-svix', (req, res) => {
    try {
        const secret = config.SVIX_ENDPOINT_SECRET;
        const verified = verifyRevertWebhook(req, secret);
        console.log('verified', verified, req.body);
        if (verified) {
            res.json({ status: 'Verified!' });
        } else {
            res.json({ error: 'Not verified' });
        }
        // Do something with the message...
    } catch (err) {
        console.error('Unverified webhook', err);
        res.status(400).json({ error: 'Unverified webhook' });
    }
});

router.post('/slack-alert', async (req, res) => {
    try {
        const email = req.body.email;
        await axios({
            method: 'post',
            url: config.SLACK_URL,
            data: JSON.stringify({ text: `Woot! :zap: ${email} signed up for Revert!` }),
        });
        await prisma.waitlist.upsert({
            where: {
                email: email,
            },
            update: {
                email: email,
            },
            create: {
                email: email,
            },
        });
        res.send({
            status: 'ok',
        });
    } catch (error: any) {
        logError(error);
        res.send({
            status: 'error',
            error: error,
        });
    }
});

router.post('/clerk/webhook', async (req, res) => {
    if (req.body) {
        let webhookData = req.body.data;
        let webhookEventType = req.body.type;
        res.status(200).send(await AuthService.createAccountOnClerkUserCreation(webhookData, webhookEventType));
    }
});

router.use('/crm', cors(), revertAuthMiddleware(), crmRouter);
router.use('/connection', cors(), revertAuthMiddleware(), connectionRouter);

register(router, {
    metadata: metadataService,
    account: accountService,
    crm: {
        lead: leadService,
        deal: dealService,
        note: noteService,
        company: companyService,
        contact: contactService,
        event: eventService,
        task: taskService,
        user: userService
    },
});

export default router;
