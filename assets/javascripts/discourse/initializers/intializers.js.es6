import { withPluginApi } from 'discourse/lib/plugin-api';
import User from 'discourse/models/user';  // Import the User model

export default {
  name: 'project-uniform',
  initialize() {
    withPluginApi('0.8.26', api => {
      console.log('Plugin initialized'); // Debugging log to ensure initialization
      api.onPageChange((url, title) => {
        console.log('Page changed:', url); // Debugging log for page change detection
        if (url && url.includes('/u/') && url.includes('/summary')) {
          console.log('Targeting user summary page'); // Debugging log for URL check
          const container = document.querySelector('.user-content');
          console.log('Container found:', container); // Log the container element

          if (container && !document.querySelector('.project-uniform-placeholder')) {
            console.log('Injecting image placeholder into stats-section');

            // Extract the username from the URL
            const username = url.split('/u/')[1].split('/')[0];
            const apiUrl = `/u/${username}.json`;  // API endpoint to fetch user data by username

            // Fetch user data for the target user
            fetch(apiUrl)
              .then(response => response.json())
              .then(userData => {
                console.log('User data:', userData); // Log user data for debugging

                // Check if the user data is valid
                if (userData && userData.user) {
                  const user = userData.user;
                  const groups = user.groups || [];  // Get the groups of the targeted user
                  const userBadges = userData.user_badges || [];  // Adjusted to access directly from userData
                  const badges = userData.badges || [];  // Access badge definitions

                  // Add more debug logs
                  console.log('User Badges (length):', userBadges.length, userBadges);
                  console.log('Available Badges (length):', badges.length, badges);

                  // Extract badge names using user_badges and badges arrays
                  const badgeNames = userBadges.map(userBadge => {
                    console.log('Inspecting userBadge:', userBadge); // Add this line
                    const matchingBadge = badges.find(badge => badge.id === userBadge.badge_id);
                    if (matchingBadge) {
                      console.log('Found matching badge:', matchingBadge); // Log if matching badge is found
                    } else {
                      console.warn('No matching badge found for userBadge:', userBadge); // Log a warning if no match is found
                    }
                    return matchingBadge ? matchingBadge.name : 'Unnamed Badge';
                  });
                 

                  // Display user's groups and badges
                  const userInfo = document.createElement('div');
                  userInfo.style.textAlign = 'center';
                  userInfo.style.marginBottom = '10px';
                  userInfo.className = 'project-uniform-user-info';

                  // Display groups
                  const groupsText = `Groups: ${groups.map(group => group.name).join(', ') || 'None'}`;
                  const groupsElement = document.createElement('p');
                  groupsElement.textContent = groupsText;

                  // Display badges
                  const badgesText = `Badges: ${badgeNames.length > 0 ? badgeNames.join(', ') : 'None'}`;
                  const badgesElement = document.createElement('p');
                  badgesElement.textContent = badgesText;

                  // Append groups and badges to the container
                  userInfo.appendChild(groupsElement);
                  userInfo.appendChild(badgesElement);

                  // Create a wrapper div around the image
                  const wrapper = document.createElement('div');
                  wrapper.style.position = 'relative';
                  wrapper.style.overflow = 'hidden';
                  wrapper.style.display = 'block'; // Change to block for full-width centering
                  wrapper.style.margin = '0 auto'; // Center the wrapper itself

                  // Add and style the image
                  const image = document.createElement('img');
                  image.src = 'https://i.imgur.com/LLRH9p2.png'; // Your new image URL
                  image.alt = 'Project Uniform Placeholder Image';
                  image.className = 'project-uniform-placeholder';

                  // Center-align the image within the wrapper
                  image.style.display = 'block';
                  image.style.margin = '0 auto';

                  // Add a soft drop shadow with increased strength
                  image.style.filter = 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))';

                  // Append the user info, image, and wrapper to the container
                  container.prepend(wrapper);
                  wrapper.appendChild(image);
                  container.prepend(userInfo);
                } else {
                  console.error('User data could not be retrieved.');
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
