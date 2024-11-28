import { withPluginApi } from 'discourse/lib/plugin-api';

export default {
  name: 'project-uniform',
  initialize(container) {
    withPluginApi('0.8.26', api => {
      const siteSettings = container.lookup('site-settings:main');

      api.onPageChange(url => {
        if (url && url.includes('/u/') && url.includes('/summary')) {
          const container = document.querySelector('.user-content');
          if (container && !document.querySelector('.project-uniform-placeholder')) {
            // Check if admin-only mode is enabled
            if (siteSettings.project_uniform_admin_only) {
              const currentUser = Discourse.User.current();
              if (!currentUser || !currentUser.admin) {
                console.log('Project Uniform: Admin-only mode is enabled. Hiding uniforms for non-admin users.');
                return; // Do not render anything for non-admin users
              }
            }

            // Extract username from URL
            const username = url.split('/u/')[1].split('/')[0];
            const apiUrl = `/u/${username}.json`;

            // Define enlisted and officer ranks
            const enlistedRanks = [
              'Recruit',
              'Private',
              'Acting_Lance_Corporal',
              'Lance_Corporal',
              'Acting_Corporal',
              'Corporal',
              'Acting_Sergeant',
              'Sergeant',
              'Staff_Sergeant',
              'Colour_Sergeant',
              'Warrant_Officer_Class_2'
            ];

            const officerRanks = [
              'Acting_Second_Lieutenant',
              'Second_Lieutenant',
              'Lieutenant',
              'Captain',
              'Major'
            ];

            // Fetch user data
            fetch(apiUrl)
              .then(response => response.ok ? response.json() : Promise.reject(response.statusText))
              .then(userData => {
                if (userData?.user) {
                  const { user, user_badges = [], badges = [] } = userData;
                  const groups = user.groups || [];

                  // Extract badge names
                  const badgeNames = user_badges.map(ub => badges.find(b => b.id === ub.badge_id)?.name || 'Unnamed Badge');

                  // Display user information
                  const userInfo = createUserInfo(groups, badgeNames);
                  container.prepend(userInfo);

                  // Retrieve and format uploaded image URLs
                  let backgroundImageUrl = '';
                  const foregroundImageUrls = []; // Array to hold multiple foreground images

                  // Determine the background image
                  if (groups.some(group => enlistedRanks.includes(group.name))) {
                    backgroundImageUrl = formatUrl(siteSettings.project_uniform_ba_enlisted_uniform);
                    console.log('Selected Enlisted Uniform:', backgroundImageUrl);
                  } else if (groups.some(group => officerRanks.includes(group.name))) {
                    backgroundImageUrl = formatUrl(siteSettings.project_uniform_ba_officers_uniform);
                    console.log('Selected Officer Uniform:', backgroundImageUrl);
                  } else {
                    console.warn('User does not belong to enlisted or officer ranks. No uniform assigned.');
                  }

                  // Add foreground images for berets and ranks
                  if (groups.some(group => group.name === 'Recruit')) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_recruit_beret));
                  } else if (
                    groups.some(group =>
                      enlistedRanks.includes(group.name) && group.name !== 'Recruit' ||
                      officerRanks.includes(group.name)
                    )
                  ) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_para_beret));
                  }

                  // Add rank-specific images
                  if (groups.some(group => group.name === 'Sergeant')) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_sgt_rank));
                  }
                  if (groups.some(group => group.name === 'Corporal')) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_cpl_bdr_rank));
                  }
                  if (groups.some(group => group.name === 'Lance_Corporal')) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_lcpl_lbdr_rank));
                  }
                  if (groups.some(group => group.name === 'Major')) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_maj_rank));
                  }

                  // Add qualification-specific images
                  if (user_badges.some(ub => badges.find(b => b.id === ub.badge_id)?.name === 'Paratrooper')) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_paratrooper_qualification));
                  }

                  // Add lanyard-specific images based on groups
                  if (
                    groups.some(group =>
                      [
                        "1_Platoon_IC",
                        "1_Platoon_2IC",
                        "1-1_Section",
                        "1-2_Section",
                        "1-3_Section"
                      ].includes(group.name)
                    )
                  ) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_1_platoon_lanyard));
                  }

                  if (
                    groups.some(group =>
                      [
                        "Fire_Support_Group_IC",
                        "Fire_Support_Group_2IC",
                        "Fire_Support_Group"
                      ].includes(group.name)
                    )
                  ) {
                    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_fsg_lanyard));
                  }

                  // Filter out invalid URLs
                  const validForegroundImageUrls = foregroundImageUrls.filter(url => url);

                  // Log selected images for debugging
                  console.log('Background Image URL:', backgroundImageUrl);
                  console.log('Foreground Image URLs:', validForegroundImageUrls);

                  // Create and merge images on a canvas
                  if (backgroundImageUrl && validForegroundImageUrls.length > 0) {
                    mergeImagesOnCanvas(container, backgroundImageUrl, validForegroundImageUrls);
                  } else {
                    console.warn('No valid images found to render.');
                  }
                }
              })
              .catch(error => console.error('Error fetching user data:', error));
          }
        }
      });
    });
  }
};

function createUserInfo(groups, badgeNames) {
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

  return userInfo;
}

function formatUrl(url) {
  if (!url) return ''; // Handle undefined or null URLs
  return url.startsWith('http') || url.startsWith('/')
    ? url
    : `${window.location.origin}/${url}`;
}

function mergeImagesOnCanvas(container, backgroundImageUrl, foregroundImageUrls) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const bgImage = new Image();
  const fgImages = foregroundImageUrls.map(url => new Image());
  let imagesLoaded = 0;

  const onImageLoad = () => {
    imagesLoaded++;
    if (imagesLoaded === 1 + fgImages.length) {
      // Set canvas size and draw images
      canvas.width = bgImage.naturalWidth || 1;
      canvas.height = bgImage.naturalHeight || 1;

      // Add drop shadow for the background image
      ctx.save(); // Save the current canvas state
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; // Shadow color
      ctx.shadowBlur = 10; // Shadow blur radius
      ctx.shadowOffsetX = 1; // Horizontal shadow offset
      ctx.shadowOffsetY = 1; // Vertical shadow offset

      // Draw the background image with shadow
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      ctx.restore(); // Restore canvas state to prevent shadow on other drawings

      // Draw foreground images
      fgImages.forEach(fgImage => {
        const fgWidth = fgImage.naturalWidth || 0;
        const fgHeight = fgImage.naturalHeight || 0;
        const fgX = (canvas.width - fgWidth) / 2;
        const fgY = (canvas.height - fgHeight) / 2;
        if (fgWidth > 0 && fgHeight > 0) {
          ctx.drawImage(fgImage, fgX, fgY, fgWidth, fgHeight);
        }
      });

      // Display the merged image
      const mergedImage = createImageElement(canvas.toDataURL('image/png'), 'Merged Project Uniform Image');
      container.prepend(mergedImage);
    }
  };

  bgImage.onload = onImageLoad;
  fgImages.forEach(fgImage => (fgImage.onload = onImageLoad));

  bgImage.src = backgroundImageUrl || '';
  fgImages.forEach((fgImage, index) => (fgImage.src = foregroundImageUrls[index] || ''));
}


function createImageElement(src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.style.display = 'block';
  img.style.margin = '0 auto';
  return img;
}