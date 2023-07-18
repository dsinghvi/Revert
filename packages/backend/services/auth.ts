import axios from 'axios';
import config from '../config';
import qs from 'qs';
import prisma from '../prisma/client';
import { v4 as uuidv4 } from 'uuid';
import isWorkEmail from '../helpers/isWorkEmail';
import { TP_ID } from '@prisma/client';
import logError from '../helpers/logError';
import { DEFAULT_SCOPE } from '../constants';

class AuthService {
    async refreshOAuthTokensForThirdParty() {
        try {
            const connections = await prisma.connections.findMany({
                include: { app: true },
            });
            for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];
                if (connection.tp_refresh_token) {
                    try {
                        if (connection.tp_id === TP_ID.hubspot) {
                            // Refresh the hubspot token.
                            const url = 'https://api.hubapi.com/oauth/v1/token';
                            const formData = {
                                grant_type: 'refresh_token',
                                client_id: connection.app.is_revert_app
                                    ? config.HUBSPOT_CLIENT_ID
                                    : connection.app_client_id || config.HUBSPOT_CLIENT_ID,
                                client_secret: connection.app.is_revert_app
                                    ? config.HUBSPOT_CLIENT_SECRET
                                    : connection.app_client_secret || config.HUBSPOT_CLIENT_SECRET,
                                redirect_uri: `${config.OAUTH_REDIRECT_BASE}/hubspot`,
                                refresh_token: connection.tp_refresh_token,
                            };
                            const result = await axios({
                                method: 'post',
                                url: url,
                                data: qs.stringify(formData),
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                                },
                            });
                            await prisma.connections.update({
                                where: {
                                    uniqueCustomerPerTenant: {
                                        tp_customer_id: connection.tp_customer_id,
                                        t_id: connection.t_id,
                                    },
                                },
                                data: {
                                    tp_access_token: result.data.access_token,
                                    tp_refresh_token: result.data.refresh_token,
                                },
                            });
                            console.log('OAuth creds refreshed for hubspot');
                        } else if (connection.tp_id === TP_ID.zohocrm) {
                            // Refresh the zoho-crm token.
                            const url = `${connection.tp_account_url}/oauth/v2/token`;
                            const formData = {
                                grant_type: 'refresh_token',
                                client_id: connection.app.is_revert_app
                                    ? config.ZOHOCRM_CLIENT_ID
                                    : connection.app_client_id || config.ZOHOCRM_CLIENT_ID,
                                client_secret: connection.app.is_revert_app
                                    ? config.ZOHOCRM_CLIENT_SECRET
                                    : connection.app_client_secret || config.ZOHOCRM_CLIENT_SECRET,
                                redirect_uri: `${config.OAUTH_REDIRECT_BASE}/zohocrm`,
                                refresh_token: connection.tp_refresh_token,
                            };
                            const result = await axios({
                                method: 'post',
                                url: url,
                                data: qs.stringify(formData),
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                                },
                            });
                            if (result.data && result.data.access_token) {
                                await prisma.connections.update({
                                    where: {
                                        uniqueCustomerPerTenant: {
                                            tp_customer_id: connection.tp_customer_id,
                                            t_id: connection.t_id,
                                        },
                                    },
                                    data: {
                                        tp_access_token: result.data.access_token,
                                    },
                                });
                                console.log('OAuth creds refreshed for zohocrm');
                            } else {
                                console.log('Zoho connection could not be refreshed', result);
                            }
                        } else if (connection.tp_id === TP_ID.sfdc) {
                            // Refresh the sfdc token.
                            const url = `https://login.salesforce.com/services/oauth2/token`;
                            const formData = {
                                grant_type: 'refresh_token',
                                client_id: connection.app.is_revert_app
                                    ? config.SFDC_CLIENT_ID
                                    : connection.app_client_id || config.SFDC_CLIENT_ID,
                                client_secret: connection.app.is_revert_app
                                    ? config.SFDC_CLIENT_SECRET
                                    : connection.app_client_secret || config.SFDC_CLIENT_SECRET,
                                redirect_uri: `${config.OAUTH_REDIRECT_BASE}/sfdc`,
                                refresh_token: connection.tp_refresh_token,
                            };
                            const result = await axios({
                                method: 'post',
                                url: url,
                                data: qs.stringify(formData),
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                                },
                            });
                            if (result.data && result.data.access_token) {
                                await prisma.connections.update({
                                    where: {
                                        uniqueCustomerPerTenant: {
                                            tp_customer_id: connection.tp_customer_id,
                                            t_id: connection.t_id,
                                        },
                                    },
                                    data: {
                                        tp_access_token: result.data.access_token,
                                    },
                                });
                                console.log('OAuth creds refreshed for sfdc');
                            } else {
                                console.log('SFDC connection could not be refreshed', result);
                            }
                        } else if (connection.tp_id === TP_ID.pipedrive) {
                            // Refresh the pipedrive token.
                            const url = 'https://oauth.pipedrive.com/oauth/token';
                            const formData = {
                                grant_type: 'refresh_token',
                                redirect_uri: `${config.OAUTH_REDIRECT_BASE}/pipedrive`,
                                refresh_token: connection.tp_refresh_token,
                            };
                            const result = await axios({
                                method: 'post',
                                url: url,
                                data: qs.stringify(formData),
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                                    Authorization: `Basic ${Buffer.from(
                                        `${
                                            connection.app.is_revert_app
                                                ? config.PIPEDRIVE_CLIENT_ID
                                                : connection.app.app_client_id || config.PIPEDRIVE_CLIENT_ID
                                        }:${
                                            connection.app.is_revert_app
                                                ? config.PIPEDRIVE_CLIENT_SECRET
                                                : connection.app.app_client_secret || config.PIPEDRIVE_CLIENT_SECRET
                                        }`
                                    ).toString('base64')}`,
                                },
                            });
                            await prisma.connections.update({
                                where: {
                                    uniqueCustomerPerTenant: {
                                        tp_customer_id: connection.tp_customer_id,
                                        t_id: connection.t_id,
                                    },
                                },
                                data: {
                                    tp_access_token: result.data.access_token,
                                    tp_refresh_token: result.data.refresh_token,
                                },
                            });
                            console.log('OAuth creds refreshed for pipedrive');
                        }
                    } catch (error: any) {
                        console.error('Could not refresh token', connection.t_id, error.response?.data);
                    }
                }
            }
        } catch (error: any) {
            logError(error);
            console.error('Could not update db', error.response?.data);
        }
        return { status: 'ok', message: 'Tokens refreshed' };
    }
    async createAccountOnClerkUserCreation(webhookData: any, webhookEventType: string) {
        let response;
        console.log('webhookData', webhookData, webhookEventType);
        if (webhookData && ['user.created'].includes(webhookEventType)) {
            try {
                const userEmail = webhookData.email_addresses[0].email_address;
                let userDomain = userEmail.split('@').pop();
                if (!isWorkEmail(userEmail)) {
                    // make the personal email the unique domain.
                    userDomain = userEmail;
                }
                // Create account only if an account does not exist for this user's domain.
                const account = await prisma.accounts.upsert({
                    where: {
                        domain: userDomain,
                    },
                    update: {},
                    create: {
                        id: 'acc_' + uuidv4(),
                        private_token: 'sk_live_' + uuidv4(),
                        public_token: 'pk_live_' + uuidv4(),
                        tenant_count: 0,
                        domain: userDomain,
                        skipWaitlist: false,
                    },
                });
                await Promise.all(
                    Object.keys(TP_ID).map(async (tp) => {
                        try {
                            await prisma.apps.create({
                                data: {
                                    id: `${tp}_${account.id}`,
                                    tp_id: tp as TP_ID,
                                    scope: [],
                                    owner_account_public_token: account.public_token,
                                    is_revert_app: true,
                                },
                            });
                        } catch (error: any) {
                            logError(error);
                        }
                    })
                );
                await prisma.users.create({
                    data: {
                        id: webhookData.id,
                        email: userEmail,
                        domain: userDomain,
                        accountId: account.id,
                    },
                });
                response = { status: 'ok' };
            } catch (e: any) {
                logError(e);
                console.error(e);
                response = { error: e };
            }
        }
        return response;
    }
    async getAccountForUser(userId: string): Promise<any> {
        if (!userId) {
            return { error: 'Bad request' };
        }
        const account = await prisma.users.findFirst({
            where: {
                id: userId,
                account: {
                    skipWaitlist: true,
                },
            },
            select: {
                account: {
                    include: {
                        apps: true,
                    },
                },
            },
        });
        if (!account) {
            return { error: 'Account does not exist' };
        }

        const appsWithScope = account.account.apps.map((app) => {
            return {
                ...app,
                scope: app.scope.length ? app.scope : DEFAULT_SCOPE[app.tp_id],
            };
        });

        return { ...account, account: { ...account.account, apps: appsWithScope } };
    }
    async setAppCredentialsForUser({
        publicToken,
        clientId,
        clientSecret,
        scopes = [],
        tpId,
        isRevertApp,
    }: {
        publicToken: string;
        clientId?: string;
        clientSecret?: string;
        scopes?: string[];
        tpId: TP_ID;
        isRevertApp: boolean;
    }): Promise<any> {
        if (!publicToken || !tpId) {
            return { error: 'Bad request' };
        }
        const account = await prisma.apps.update({
            where: {
                owner_account_public_token_tp_id: { owner_account_public_token: publicToken, tp_id: tpId },
            },
            data: {
                ...(clientId && { app_client_id: clientId }),
                ...(clientSecret && { app_client_secret: clientSecret }),
                is_revert_app: isRevertApp,
                ...(scopes.filter(Boolean).length && { scope: scopes }),
            },
        });
        if (!account) {
            return { error: 'Account does not exist' };
        }

        return account;
    }
}

export default new AuthService();
