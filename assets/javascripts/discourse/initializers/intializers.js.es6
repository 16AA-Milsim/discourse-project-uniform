import { withPluginApi } from 'discourse/lib/plugin-api';

export default {
  name: 'project-uniform',
  initialize() {
    withPluginApi('0.8.26', api => {
      api.onPageChange(url => {
        if (url && url.includes('/u/') && url.includes('/summary')) {
          const container = document.querySelector('.user-content');
          if (container && !document.querySelector('.project-uniform-placeholder')) {

            // Extract username from URL
            const username = url.split('/u/')[1].split('/')[0];
            const apiUrl = `/u/${username}.json`;

            // Fetch user data
            fetch(apiUrl)
              .then(response => response.ok ? response.json() : Promise.reject(response.statusText))
              .then(userData => {
                if (userData && userData.user) {
                  const user = userData.user;
                  const groups = user.groups || [];
                  const userBadges = userData.user_badges || [];
                  const badges = userData.badges || [];

                  // Extract badge names
                  const badgeNames = userBadges.map(userBadge => {
                    const matchingBadge = badges.find(badge => badge.id === userBadge.badge_id);
                    return matchingBadge ? matchingBadge.name : 'Unnamed Badge';
                  });

                  // Create and append user info elements
                  const userInfo = document.createElement('div');
                  userInfo.style.textAlign = 'center';
                  userInfo.style.marginBottom = '10px';
                  userInfo.className = 'project-uniform-user-info';

                  const groupsElement = document.createElement('p');
                  groupsElement.textContent = `Groups: ${groups.map(group => group.name).join(', ') || 'None'}`;

                  const badgesElement = document.createElement('p');
                  badgesElement.textContent = `Badges: ${badgeNames.length > 0 ? badgeNames.join(', ') : 'None'}`;

                  userInfo.appendChild(groupsElement);
                  userInfo.appendChild(badgesElement);

                  // Retrieve and format the uploaded image URL
                  let uploadedImageUrl = Discourse.SiteSettings.project_uniform_image_upload;
                  if (uploadedImageUrl && uploadedImageUrl.startsWith('/')) {
                    uploadedImageUrl = `${window.location.origin}${uploadedImageUrl}`;
                  }

                  if (uploadedImageUrl) {
                    // Create and style image wrapper
                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.style.overflow = 'hidden';
                    wrapper.style.display = 'block';
                    wrapper.style.margin = '0 auto';

                    const image = document.createElement('img');
                    image.src = uploadedImageUrl;
                    image.alt = 'Project Uniform Placeholder Image';
                    image.className = 'project-uniform-placeholder';
                    image.style.display = 'block';
                    image.style.margin = '0 auto';
                    image.style.filter = 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))';

                    wrapper.appendChild(image);
                    container.prepend(wrapper);
                  }

                  container.prepend(userInfo);
                }
              })
              .catch(error => {
                console.error('Error fetching user data:', error);
              });
          }
        }
      });
    });
  }
};
