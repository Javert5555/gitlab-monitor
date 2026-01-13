const axios = require('axios');

module.exports = async function checkSEC2(projectId, projectData, gitlab) {

    const {
      projectMembers = [],
      projectDetails = {},
      projectVariables,
      deployKeys
    } = projectData;


  const results = [];
  
  try {
    // 1. Получаем всех участников проекта с расширенными данными
    // const members = await gitlab.getProjectMembers(projectId);
    // const projectDetails = await gitlab.getProjectDetails(projectId);
    // const projectVariables = await gitlab.getProjectVariables(projectId);
    // const deployKeys = await gitlab.getDeployKeys(projectId);


    // 2. Проверка избыточных прав
    const owners = projectMembers.filter(m => m.access_level === 50); // Owner
    const maintainers = projectMembers.filter(m => m.access_level === 40); // Maintainer
    
    results.push({
      item: "Пользователи с правами Owner",
      status: owners.length > 1 ? "FAIL" : "OK",
      details: owners.length > 1 
        ? `Обнаружено ${owners.length} пользователей с правами Owner: ${owners.map(u => u.username).join(', ')}. Рекомендуется оставить только одного Owner.`
        : "Количество пользователей с правами Owner соответствует рекомендациям (1).",
      severity: "high"
    });
    
    // 3. Проверка неактивных учётных записей (более 90 дней)
    const now = new Date();
    const inactiveThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней в миллисекундах
    // console.log(projectMembers)
    const inactiveUsers = projectMembers.filter(m => m.state !== 'active');
    
    results.push({
      item: "Неактивные учётные записи",
      status: inactiveUsers.length > 0 ? "WARN" : "OK",
      details: inactiveUsers.length > 0
        ? `Обнаружено ${inactiveUsers.length} неактивных учётных записей (более 90 дней): ${inactiveUsers.map(u => u.username).join(', ')}. Рекомендуется удалить или отозвать доступ.`
        : "Все учётные записи активны.",
      severity: "medium"
    });
    
    // -. Проверка даты истечения
    const notExpiresMembers = projectMembers.filter(m => !m.expires_at);
    
    // console.log(notExpiresMembers)
    results.push({
      item: "Внешние участники (личные email)",
      status: "INFO",
      details: notExpiresMembers.length > 0
        ? `Рекомендовано установить срок действия для учетных записей, связанных с данным проектом: ${notExpiresMembers.map(u => `${u.username}`).join(', ')}.`
        : "Срок действия для всех учетных записей, связанных с данным проектом, установлен.",
      severity: "info"
    });
    
    // 7. Проверка deploy keys без ограничений
    if (deployKeys && deployKeys.length > 0) {
      const unrestrictedKeys = deployKeys.filter(key => !key.can_push);
      // console.log(deployKeys)
      
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
      status: accessTokens.length > 0 ? "DANGER" : "OK",
      details: accessTokens.length > 0
        ? `Обнаружено ${accessTokens.length} токенов доступа в переменных. Убедитесь, что токены имеют ограниченный срок действия и минимальные необходимые права.`
        : "Токены доступа не обнаружены в переменных проекта.",
      severity: "high"
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
    id: "SEC-CICD-2",
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