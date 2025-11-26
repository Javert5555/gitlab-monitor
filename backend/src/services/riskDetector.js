const gitLabService = require('./gitlabService')

const riskDetector = async () => {
  const allProjects = await gitLabService.getAllProjects()
  console.log(allProjects)
}

riskDetector()

module.exports = riskDetector;