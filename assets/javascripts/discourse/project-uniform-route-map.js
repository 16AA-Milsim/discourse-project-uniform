// assets/javascripts/discourse/project-uniform-route-map.js

export default {
    resource: 'admin.adminPlugins',
    path: '/plugins',
    map() {
      this.route('project-uniform');
    }
  };
  