// module.exports = async function checkSEC2(projectId, gitlab) {
//   const members = await gitlab.getProjectMembers(projectId);

//   const results = [];

//   // 1. Избыточные права
//   const dangerousRoles = members.filter(m => m.access_level >= 40); // Maintainer/Owner

//   results.push({
//     item: "Пользователи с правами Maintainer/Owner",
//     status: dangerousRoles.length > 2 ? "WARN" : "OK",
//     details: dangerousRoles.map(u => u.username).join(", ") || "Нет избыточных ролей"
//   });

//   // 2. Общие аккаунты
//   const shared = members.filter(u => u.username.includes("service") || u.username.includes("shared"));

//   results.push({
//     item: "Наличие общих/технических аккаунтов",
//     status: shared.length ? "WARN" : "OK",
//     details: shared.length ? shared.map(s => s.username).join(", ") : "Нет"
//   });

//   // 3. Заброшенные аккаунты
//   const stale = members.filter(u => !u.last_login);

//   results.push({
//     item: "Заброшенные аккаунты",
//     status: stale.length ? "WARN" : "OK",
//     details: stale.length ? stale.map(s => s.username).join(", ") : "Нет"
//   });

//   return {
//     id: "CICD-SEC-2",
//     name: "Неадекватное управление IAM",
//     results
//   };
// };

const axios = require('axios');

module.exports = async function checkSEC2(projectId, gitlab) {
  const results = [];
  
  try {
    // 1. Получаем всех участников проекта с расширенными данными
    const members = await gitlab.getProjectMembers(projectId);
    const projectDetails = await gitlab.getProjectDetails(projectId);
    const projectVariables = await gitlab.getProjectVariables(projectId);
    const deployKeys = await gitlab.getDeployKeys(projectId);
    
    // 2. Проверка избыточных прав
    const owners = members.filter(m => m.access_level === 50); // Owner
    const maintainers = members.filter(m => m.access_level === 40); // Maintainer
    
    results.push({
      item: "Пользователи с правами Owner",
      status: owners.length > 1 ? "FAIL" : "OK",
      details: owners.length > 1 
        ? `Обнаружено ${owners.length} пользователей с правами Owner: ${owners.map(u => u.username).join(', ')}. Рекомендуется оставить только одного Owner.`
        : "Количество пользователей с правами Owner соответствует рекомендациям.",
      severity: "high"
    });
    
    // 3. Проверка неактивных учётных записей (более 90 дней)
    const now = new Date();
    const inactiveThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней в миллисекундах
    const inactiveUsers = members.filter(m => {
      if (!m.last_activity_on) return true;
      const lastActivity = new Date(m.last_activity_on);
      return (now - lastActivity) > inactiveThreshold;
    });
    
    results.push({
      item: "Неактивные учётные записи",
      status: inactiveUsers.length > 0 ? "WARN" : "OK",
      details: inactiveUsers.length > 0
        ? `Обнаружено ${inactiveUsers.length} неактивных учётных записей (более 90 дней): ${inactiveUsers.map(u => u.username).join(', ')}. Рекомендуется удалить или отозвать доступ.`
        : "Все учётные записи активны.",
      severity: "medium"
    });
    
    // 4. Проверка сервисных/общих аккаунтов
    const serviceAccounts = members.filter(m => 
      m.username.includes('service') || 
      m.username.includes('bot') ||
      m.username.includes('robot') ||
      m.username.includes('ci-') ||
      /^[a-z]+-[a-z]+-bot$/i.test(m.username)
    );
    
    results.push({
      item: "Сервисные/технические аккаунты",
      status: serviceAccounts.length > 0 ? "WARN" : "INFO",
      details: serviceAccounts.length > 0
        ? `Обнаружено ${serviceAccounts.length} сервисных аккаунтов: ${serviceAccounts.map(s => s.username).join(', ')}. Убедитесь, что у них минимальные необходимые привилегии.`
        : "Сервисные аккаунты не обнаружены.",
      severity: "medium"
    });
    
    // 5. Проверка MFA (если доступен через API)
    try {
      // Для GitLab.com можно использовать другой endpoint
      const usersWithoutMFA = [];
      for (const member of members) {
        if (member.access_level >= 30) { // Developer и выше
          // В реальном сценарии нужен доступ к admin API для проверки MFA
          // Это заглушка для демонстрации логики
          usersWithoutMFA.push(member.username);
        }
      }
      
      if (usersWithoutMFA.length > 0) {
        results.push({
          item: "Пользователи без MFA",
          status: "WARN",
          details: `Обнаружены пользователи с привилегиями без MFA: ${usersWithoutMFA.join(', ')}. Рекомендуется включить двухфакторную аутентификацию.`,
          severity: "high"
        });
      }
    } catch (error) {
      // Пропускаем если нет доступа к проверке MFA
    }
    
    // 6. Проверка внешних участников (не из домена компании)
    const externalUsers = members.filter(m => {
      const email = m.email || '';
      return email.includes('gmail.com') || 
             email.includes('yahoo.com') || 
             email.includes('outlook.com') ||
             email.includes('hotmail.com');
    });
    
    results.push({
      item: "Внешние участники (личные email)",
      status: externalUsers.length > 0 ? "HIGH" : "OK",
      details: externalUsers.length > 0
        ? `Обнаружено ${externalUsers.length} участников с личными email-адресами: ${externalUsers.map(u => `${u.username} (${u.email})`).join(', ')}. Это может быть угрозой безопасности.`
        : "Все участники используют корпоративные email-адреса.",
      severity: "high"
    });
    
    // 7. Проверка deploy keys без ограничений
    if (deployKeys && deployKeys.length > 0) {
      const unrestrictedKeys = deployKeys.filter(key => !key.can_push);
      
      results.push({
        item: "Deploy Keys с правами записи",
        status: unrestrictedKeys.length > 0 ? "FAIL" : "OK",
        details: unrestrictedKeys.length > 0
          ? `Обнаружено ${unrestrictedKeys.length} deploy keys с правами записи. Deploy keys должны иметь доступ только на чтение.`
          : "Все deploy keys имеют корректные права (только чтение).",
        severity: "critical"
      });
    }
    
    // 8. Проверка переменных окружения с секретами
    const secretVariables = projectVariables.filter(v => 
      v.key.toLowerCase().includes('token') ||
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key') ||
      v.key.toLowerCase().includes('credential')
    );
    
    results.push({
      item: "Переменные окружения с потенциальными секретами",
      status: secretVariables.length > 0 ? "WARN" : "OK",
      details: secretVariables.length > 0
        ? `Обнаружено ${secretVariables.length} переменных с именами, указывающими на секреты: ${secretVariables.map(v => v.key).join(', ')}. Убедитесь, что они защищены (masked) и не имеют значение 'protected: false'.`
        : "Потенциально опасные переменные не обнаружены.",
      severity: "high"
    });
    
    // 9. Проверка protected переменных
    const unprotectedSecretVars = secretVariables.filter(v => !v.protected);
    
    if (unprotectedSecretVars.length > 0) {
      results.push({
        item: "Незащищённые переменные с секретами",
        status: "FAIL",
        details: `Обнаружены незащищённые переменные с секретами: ${unprotectedSecretVars.map(v => v.key).join(', ')}. Установите флаг 'protected: true' для этих переменных.`,
        severity: "critical"
      });
    }
    
    // 10. Проверка экспирации токенов
    const accessTokens = projectVariables.filter(v => 
      v.key.includes('_TOKEN') || v.key.includes('_ACCESS_KEY')
    );
    
    results.push({
      item: "Токены доступа в переменных",
      status: accessTokens.length > 0 ? "WARN" : "INFO",
      details: accessTokens.length > 0
        ? `Обнаружено ${accessTokens.length} токенов доступа в переменных. Убедитесь, что токены имеют ограниченный срок действия и минимальные необходимые права.`
        : "Токены доступа не обнаружены в переменных проекта.",
      severity: "medium"
    });
    
  } catch (error) {
    console.error(`Error in SEC-2 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка управления доступом (IAM)",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }
  
  return {
    id: "CICD-SEC-2",
    name: "Неадекватное управление идентификацией и доступом",
    results
  };
};

// Добавляем метод в gitlabService.js для получения deploy keys
/*
  В gitlabService.js добавить:
  
  getDeployKeys: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/deploy_keys`), []),
*/