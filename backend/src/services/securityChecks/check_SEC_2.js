const axios = require('axios');

module.exports = async function checkSEC2(projectId, projectData, gitlab) {
    const {
        projectMembers = [],
        projectDetails = {},
        projectVariables,
        deployKeys,
        projectHooks = [],
        allUsers = [],
        projectRunners = [],
        protectedBranches = [],
        branches = []
    } = projectData;

    const results = [];

    try {
        const owners = projectMembers.filter(m => m.access_level === 50);
        const maintainers = projectMembers.filter(m => m.access_level === 40);
        const developers = projectMembers.filter(m => m.access_level === 30);
        const reporters = projectMembers.filter(m => m.access_level === 20);
        const guests = projectMembers.filter(m => m.access_level === 10);

        results.push({
            item: "Пользователи с правами Owner",
            status: owners.length > 1 ? "WARN" : "INFO",
            details: owners.length > 1
                ? `Обнаружено ${owners.length} пользователей с правами Owner: ${owners.map(u => u.username).join(', ')}. Рекомендуется оставить только одного Owner.`
                : "Количество пользователей с правами Owner соответствует рекомендациям (1).",
        });

        if (maintainers.length > 3) {
            results.push({
                item: "Избыточное количество Maintainers",
                status: "WARN",
                details: `Обнаружено ${maintainers.length} пользователей с правами Maintainer: ${maintainers.map(u => u.username).join(', ')}. Рекомендуется ограничить до 2-3 человек.`,
            });
        }

        const inactiveUsers = projectMembers.filter(m => m.state !== 'active');

        results.push({
            item: "Неактивные учётные записи",
            status: inactiveUsers.length > 0 ? "WARN" : "INFO",
            details: inactiveUsers.length > 0
                ? `Обнаружено ${inactiveUsers.length} неактивных учётных записей: ${inactiveUsers.map(u => u.username).join(', ')}. Рекомендуется удалить или отозвать доступ.`
                : "Все учётные записи активны.",
        });

        const notExpiresMembers = projectMembers.filter(m => !m.expires_at);

        results.push({
            item: "Участники без срока действия доступа",
            status: notExpiresMembers.length > 0 ? "WARN" : "INFO",
            details: notExpiresMembers.length > 0
                ? `Рекомендовано установить срок действия для ${notExpiresMembers.length} учетных записей: ${notExpiresMembers.slice(0, 5).map(u => u.username).join(', ')}${notExpiresMembers.length > 5 ? '...' : ''}`
                : "Срок действия для всех учетных записей установлен.",
        });

        const usersWithMultipleRoles = [];
        projectMembers.forEach(member => {
            if (member.permissions) {
                const roles = [];
                if (member.permissions.project_access) roles.push(`project:${member.permissions.project_access.access_level}`);
                if (member.permissions.group_access) roles.push(`group:${member.permissions.group_access.access_level}`);
                if (roles.length > 1) {
                    usersWithMultipleRoles.push(`${member.username} (${roles.join(', ')})`);
                }
            }
        });

        if (usersWithMultipleRoles.length > 0) {
            results.push({
                item: "Пользователи с несколькими ролями",
                status: "WARN",
                details: `Обнаружено ${usersWithMultipleRoles.length} пользователей с несколькими ролями: ${usersWithMultipleRoles.join(', ')}. Проверьте необходимость всех ролей.`,
            });
        }

        const externalContributors = projectMembers.filter(m => 
            m.external === true || 
            m.access_level === 10 || 
            (m.email && (m.email.includes('gmail.com') || m.email.includes('yandex.ru') || m.email.includes('mail.ru')))
        );

        if (externalContributors.length > 0) {
            results.push({
                item: "Внешние контрибьюторы",
                status: "WARN",
                details: `Обнаружено ${externalContributors.length} внешних контрибьюторов: ${externalContributors.slice(0, 5).map(u => u.username).join(', ')}${externalContributors.length > 5 ? '...' : ''}. Убедитесь в ограничении их прав.`,
            });
        }

        const usersWithUnusualNames = projectMembers.filter(m =>
            m.username.includes('admin') ||
            m.username.includes('root') ||
            m.username.includes('superuser') ||
            m.username.includes('master')
        );

        if (usersWithUnusualNames.length > 0) {
            results.push({
                item: "Пользователи с подозрительными именами",
                status: "WARN",
                details: `Обнаружено ${usersWithUnusualNames.length} пользователей с подозрительными именами: ${usersWithUnusualNames.map(u => u.username).join(', ')}. Проверьте их необходимость.`,
            });
        }

        if (projectRunners && projectRunners.length > 0) {
            const privilegedRunners = projectRunners.filter(r => 
                r.tag_list && r.tag_list.includes('privileged')
            );

            if (privilegedRunners.length > 0) {
                results.push({
                    item: "Привилегированные раннеры",
                    status: "WARN",
                    details: `Обнаружено ${privilegedRunners.length} привилегированных раннеров. Они имеют root-доступ к хосту.`,
                });
            }

            const runnersWithHighConcurrency = projectRunners.filter(r => 
                r.maximum_timeout && r.maximum_timeout > 3600
            );

            if (runnersWithHighConcurrency.length > 0) {
                results.push({
                    item: "Раннеры с высоким таймаутом",
                    status: "INFO",
                    details: `Обнаружено ${runnersWithHighConcurrency.length} раннеров с таймаутом более 1 часа.`,
                });
            }
        }

        if (protectedBranches && protectedBranches.length > 0) {
            const branchesWithForcePush = protectedBranches.filter(b => b.allow_force_push === true);

            if (branchesWithForcePush.length > 0) {
                results.push({
                    item: "Ветки с разрешенным force push",
                    status: "WARN",
                    details: `Обнаружено ${branchesWithForcePush.length} защищенных веток с разрешенным force push: ${branchesWithForcePush.map(b => b.name).join(', ')}.`,
                });
            }

            const branchesWithDeveloperPush = protectedBranches.filter(b => 
                b.push_access_levels && b.push_access_levels.some(level => level.access_level === 30)
            );

            if (branchesWithDeveloperPush.length > 0) {
                results.push({
                    item: "Защищенные ветки с push для разработчиков",
                    status: "WARN",
                    details: `Обнаружено ${branchesWithDeveloperPush.length} защищенных веток, где разработчики могут делать push: ${branchesWithDeveloperPush.map(b => b.name).join(', ')}.`,
                });
            }
        }

        const projectAdmins = projectMembers.filter(m => m.access_level >= 40);
        if (projectAdmins.length > 5) {
            results.push({
                item: "Избыточное количество администраторов проекта",
                status: "WARN",
                details: `Обнаружено ${projectAdmins.length} пользователей с правами администратора проекта. Рекомендуется ограничить до 3-5 человек.`,
            });
        }

        const usersWithAdminEverywhere = [];
        if (allUsers && allUsers.length > 0) {
            const adminUsers = allUsers.filter(u => u.is_admin === true);
            adminUsers.forEach(admin => {
                const projectMembership = projectMembers.find(m => m.id === admin.id);
                if (projectMembership) {
                    usersWithAdminEverywhere.push(admin.username);
                }
            });
        }

        if (usersWithAdminEverywhere.length > 0) {
            results.push({
                item: "Глобальные администраторы с доступом к проекту",
                status: "INFO",
                details: `Обнаружено ${usersWithAdminEverywhere.length} глобальных администраторов с доступом к проекту: ${usersWithAdminEverywhere.join(', ')}.`,
            });
        }

        const serviceAccounts = projectMembers.filter(m =>
            m.username.includes('bot') ||
            m.username.includes('service') ||
            m.username.includes('deploy') ||
            m.username.includes('ci') ||
            m.name?.toLowerCase().includes('robot') ||
            m.name?.toLowerCase().includes('bot')
        );

        if (serviceAccounts.length > 0) {
            const highPrivilegeServiceAccounts = serviceAccounts.filter(sa => 
                sa.access_level >= 40
            );

            if (highPrivilegeServiceAccounts.length > 0) {
                results.push({
                    item: "Сервисные аккаунты с высокими правами",
                    status: "WARN",
                    details: `Обнаружено ${highPrivilegeServiceAccounts.length} сервисных аккаунтов с правами администратора: ${highPrivilegeServiceAccounts.map(u => u.username).join(', ')}.`,
                });
            }
        }

        const usersWithoutAvatar = projectMembers.filter(m => !m.avatar_url || m.avatar_url.includes('default'));
        if (usersWithoutAvatar.length > 0) {
            results.push({
                item: "Пользователи без аватарки",
                status: "INFO",
                details: `Обнаружено ${usersWithoutAvatar.length} пользователей без аватарки. Это могут быть служебные аккаунты.`,
            });
        }

        const usersCreatedRecently = projectMembers.filter(m => {
            if (!m.created_at) return false;
            const created = new Date(m.created_at);
            const now = new Date();
            const diffDays = (now - created) / (1000 * 60 * 60 * 24);
            return diffDays < 7;
        });

        if (usersCreatedRecently.length > 0) {
            results.push({
                item: "Недавно созданные пользователи с доступом",
                status: "INFO",
                details: `Обнаружено ${usersCreatedRecently.length} пользователей, добавленных менее недели назад: ${usersCreatedRecently.map(u => u.username).join(', ')}.`,
            });
        }

        const usersWithLastActivity = projectMembers.filter(m => {
            if (!m.last_activity_on) return false;
            const lastActivity = new Date(m.last_activity_on);
            const now = new Date();
            const diffDays = (now - lastActivity) / (1000 * 60 * 60 * 24);
            return diffDays > 180;
        });

        if (usersWithLastActivity.length > 0) {
            results.push({
                item: "Пользователи без активности более 6 месяцев",
                status: "WARN",
                details: `Обнаружено ${usersWithLastActivity.length} пользователей без активности более 6 месяцев: ${usersWithLastActivity.slice(0, 5).map(u => u.username).join(', ')}${usersWithLastActivity.length > 5 ? '...' : ''}.`,
            });
        }

        const userAccessLevelDistribution = {
            Owner: owners.length,
            Maintainer: maintainers.length,
            Developer: developers.length,
            Reporter: reporters.length,
            Guest: guests.length
        };

        results.push({
            item: "Распределение ролей в проекте",
            status: "INFO",
            details: `Owner: ${userAccessLevelDistribution.Owner}, Maintainer: ${userAccessLevelDistribution.Maintainer}, Developer: ${userAccessLevelDistribution.Developer}, Reporter: ${userAccessLevelDistribution.Reporter}, Guest: ${userAccessLevelDistribution.Guest}`,
        });

        if (deployKeys && deployKeys.length > 0) {
            const unrestrictedKeys = deployKeys.filter(key => !key.can_push);

            results.push({
                item: "Deploy Keys с правами записи",
                status: unrestrictedKeys.length > 0 ? "FAIL" : "OK",
                details: unrestrictedKeys.length > 0
                    ? `Обнаружено ${unrestrictedKeys.length} deploy keys с правами записи. Deploy keys должны иметь доступ только на чтение.`
                    : "Все deploy keys имеют корректные права (только чтение).",
            });

            const expiredDeployKeys = deployKeys.filter(key => key.expires_at && new Date(key.expires_at) < new Date());
            if (expiredDeployKeys.length > 0) {
                results.push({
                    item: "Просроченные Deploy Keys",
                    status: "WARN",
                    details: `Обнаружено ${expiredDeployKeys.length} просроченных deploy keys: ${expiredDeployKeys.map(k => k.title || k.id).join(', ')}. Рекомендуется удалить.`,
                });
            }
        }

        const secretVariables = projectVariables.filter(v =>
            v.key.toLowerCase().includes('token') ||
            v.key.toLowerCase().includes('secret') ||
            v.key.toLowerCase().includes('password') ||
            v.key.toLowerCase().includes('key') ||
            v.key.toLowerCase().includes('credential')
        );

        results.push({
            item: "Переменные окружения с потенциальными секретами",
            status: secretVariables.length > 0 ? "WARN" : "INFO",
            details: secretVariables.length > 0
                ? `Обнаружено ${secretVariables.length} переменных с именами, указывающими на секреты: ${secretVariables.map(v => v.key).join(', ')}. Убедитесь, что они защищены (masked) и не имеют значение 'protected: false'.`
                : "Потенциально опасные переменные не обнаружены.",
        });

        const unprotectedSecretVars = secretVariables.filter(v => !v.protected);

        if (unprotectedSecretVars.length > 0) {
            results.push({
                item: "Незащищённые переменные с секретами",
                status: "FAIL",
                details: `Обнаружены незащищённые переменные с секретами: ${unprotectedSecretVars.map(v => v.key).join(', ')}. Установите флаг 'protected: true' для этих переменных.`,
            });
        }

        const unmaskedSecretVars = secretVariables.filter(v => !v.masked);
        if (unmaskedSecretVars.length > 0) {
            results.push({
                item: "Незамаскированные секретные переменные",
                status: "WARN",
                details: `Обнаружено ${unmaskedSecretVars.length} незамаскированных секретных переменных: ${unmaskedSecretVars.map(v => v.key).join(', ')}. Установите флаг 'masked: true' для скрытия значений в логах.`,
            });
        }

        const accessTokens = projectVariables.filter(v =>
            v.key.includes('_TOKEN') || v.key.includes('_ACCESS_KEY')
        );

        results.push({
            item: "Токены доступа в переменных",
            status: accessTokens.length > 0 ? "WARN" : "INFO",
            details: accessTokens.length > 0
                ? `Обнаружено ${accessTokens.length} токенов доступа в переменных. Убедитесь, что токены имеют ограниченный срок действия и минимальные необходимые права.`
                : "Токены доступа не обнаружены в переменных проекта.",
        });

        const developersWithAdminRights = projectMembers.filter(m =>
            m.access_level === 30 &&
            (m.permissions?.project_access?.access_level >= 40 ||
                m.permissions?.group_access?.access_level >= 40)
        );

        if (developersWithAdminRights.length > 0) {
            results.push({
                item: "Разработчики с административными правами",
                status: "WARN",
                details: `Обнаружено ${developersWithAdminRights.length} разработчиков с расширенными правами: ${developersWithAdminRights.map(u => u.username).join(', ')}. Проверьте необходимость таких прав.`,
            });
        }

        if (projectHooks && projectHooks.length > 0) {
            const insecureWebhooks = projectHooks.filter(hook => !hook.enable_ssl_verification);
            if (insecureWebhooks.length > 0) {
                results.push({
                    item: "Небезопасные Webhooks",
                    status: "FAIL",
                    details: `Обнаружено ${insecureWebhooks.length} webhooks без проверки SSL: ${insecureWebhooks.map(h => h.url).join(', ')}.`,
                });
            }

            const publicWebhooks = projectHooks.filter(hook =>
                hook.url && (
                    hook.url.includes('localhost') ||
                    hook.url.includes('127.0.0.1') ||
                    hook.url.includes('0.0.0.0')
                )
            );
            if (publicWebhooks.length > 0) {
                results.push({
                    item: "Webhooks с локальными адресами",
                    status: "WARN",
                    details: `Обнаружено ${publicWebhooks.length} webhooks с локальными адресами. Они могут быть недоступны из внешней сети.`,
                });
            }
        }

        const externalEmailDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
        const externalUsers = projectMembers.filter(m => {
            if (!m.email) return false;
            return externalEmailDomains.some(domain => m.email.endsWith(domain));
        });

        if (externalUsers.length > 0) {
            results.push({
                item: "Внешние пользователи",
                status: "WARN",
                details: `Обнаружено ${externalUsers.length} пользователей с публичными email доменами: ${externalUsers.map(u => u.username).join(', ')}. Убедитесь в их доверенности.`,
            });
        }

        const usersWithout2FA = [];
        if (usersWithout2FA.length > 0) {
            results.push({
                item: "Пользователи без двухфакторной аутентификации",
                status: "WARN",
                details: `Обнаружено ${usersWithout2FA.length} пользователей без 2FA: ${usersWithout2FA.slice(0, 3).join(', ')}${usersWithout2FA.length > 3 ? '...' : ''}. Рекомендуется включить 2FA.`,
            });
        }

        const globalAdmins = projectMembers.filter(m => m.access_level >= 50);
        if (globalAdmins.length > 0) {
            results.push({
                item: "Глобальные администраторы в проекте",
                status: "INFO",
                details: `В проекте участвуют ${globalAdmins.length} глобальных администраторов: ${globalAdmins.map(u => u.username).join(', ')}.`,
            });
        }

        const groupsWithHighAccess = projectMembers.filter(m =>
            m.access_level >= 40 && m.source_type === 'Namespace'
        );
        if (groupsWithHighAccess.length > 0) {
            results.push({
                item: "Группы с высокими правами доступа",
                status: "INFO",
                details: `Проект наследует права от ${groupsWithHighAccess.length} групп с высокими правами доступа.`,
            });
        }

    } catch (error) {
        console.error(`Error in SEC-2 check for project ${projectId}:`, error);
        results.push({
            item: "Проверка управления доступом (IAM)",
            status: "FAIL",
            details: `Ошибка при выполнении проверки: ${error.message}`,
        });
    }

    return {
        id: "SEC-CICD-2",
        name: "Неадекватное управление идентификацией и доступом",
        results
    };
};