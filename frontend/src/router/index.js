import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Projects from '../views/Projects.vue'
import ProjectDetails from '../views/ProjectDetails.vue'
// import Scans from '../views/Scans.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/projects',
    name: 'Projects',
    component: Projects
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetails',
    component: ProjectDetails,
    props: true
  },
  // {
  //   path: '/scans',
  //   name: 'Scans',
  //   component: Scans
  // }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router