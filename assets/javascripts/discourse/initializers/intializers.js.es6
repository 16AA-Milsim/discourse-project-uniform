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
                if (userData?.user) {
                  const { user, user_badges = [], badges = [] } = userData;
                  const groups = user.groups || [];

                  // Extract badge names
                  const badgeNames = user_badges.map(ub => badges.find(b => b.id === ub.badge_id)?.name || 'Unnamed Badge');

                  // Display user information
                  const userInfo = createUserInfo(groups, badgeNames);
                  container.prepend(userInfo);

                  // Retrieve and format uploaded image URLs
                  const backgroundImageUrl = formatUrl(Discourse.SiteSettings.ba_enlisted_uniform);
                  let foregroundImageUrl = '';

                  // Conditionally add images based on group membership
                  if (groups.some(group => group.name === 'Sergeant')) {
                    foregroundImageUrl = formatUrl(Discourse.SiteSettings.sgt_rank);
                  } else if (groups.some(group => group.name === 'Corporal')) {
                    foregroundImageUrl = formatUrl(Discourse.SiteSettings.cpl_bdr_rank);
                  } else if (groups.some(group => group.name === 'Bombardier')) {
                    foregroundImageUrl = formatUrl(Discourse.SiteSettings.cpl_bdr_rank);
                  } else if (groups.some(group => group.name === 'Lance_Corporal')) {
                    foregroundImageUrl = formatUrl(Discourse.SiteSettings.lcpl_lbdr_rank);
                  } else if (groups.some(group => group.name === 'Lance_Bombardier')) {
                    foregroundImageUrl = formatUrl(Discourse.SiteSettings.lcpl_lbdr_rank);
                  }

                  // Create and merge images on a canvas
                  mergeImagesOnCanvas(container, backgroundImageUrl, foregroundImageUrl);
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
  return url?.startsWith('/') ? `${window.location.origin}${url}` : url;
}

function mergeImagesOnCanvas(container, backgroundImageUrl, foregroundImageUrl) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const bgImage = new Image();
  const fgImage = new Image();
  let imagesLoaded = 0;

  const onImageLoad = () => {
    imagesLoaded++;
    if (imagesLoaded === 2 || (imagesLoaded === 1 && !foregroundImageUrl)) {
      // Set canvas size and draw images
      canvas.width = bgImage.naturalWidth || 1;
      canvas.height = bgImage.naturalHeight || 1;

      // Add shadow for background image
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; // Shadow color
      ctx.shadowBlur = 10; // Shadow blur radius
      ctx.shadowOffsetX = 0; // Horizontal offset
      ctx.shadowOffsetY = 0; // Vertical offset

      // Draw the background image with shadow
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

      // Reset shadow settings to prevent it from affecting the foreground image
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      if (foregroundImageUrl) {
        const fgWidth = fgImage.naturalWidth || 0;
        const fgHeight = fgImage.naturalHeight || 0;
        const fgX = (canvas.width - fgWidth) / 2;
        const fgY = (canvas.height - fgHeight) / 2;
        if (fgWidth > 0 && fgHeight > 0) {
          ctx.drawImage(fgImage, fgX, fgY, fgWidth, fgHeight);
        }
      }

      // Display the merged image
      const mergedImage = createImageElement(canvas.toDataURL('image/png'), 'Merged Project Uniform Image');
      container.prepend(mergedImage);
    }
  };

  bgImage.onload = onImageLoad;
  fgImage.onload = onImageLoad;
  bgImage.onerror = onImageLoad;
  fgImage.onerror = onImageLoad;

  bgImage.src = backgroundImageUrl || '';
  fgImage.src = foregroundImageUrl || '';
}

function createImageElement(src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.style.display = 'block';
  img.style.margin = '0 auto';
  img.style.position = 'relative';
  return img;
}

function createTooltip(element, fgX, fgY, fgWidth, fgHeight, fgImage) {
  const tooltip = document.createElement('div');
  const tooltipText = Discourse.SiteSettings.project_uniform_tooltip_text || 'Center foreground image tooltip';
  tooltip.textContent = tooltipText;
  tooltip.style.position = 'absolute';
  tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '5px';
  tooltip.style.borderRadius = '3px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.visibility = 'hidden';
  tooltip.style.zIndex = '1000';
  tooltip.style.transition = 'opacity 0.05s';
  tooltip.style.opacity = '0';
  tooltip.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';

  // Add an optional tooltip image
  const tooltipImageUrl = Discourse.SiteSettings.project_uniform_tooltip_image;
  if (tooltipImageUrl) {
    const tooltipImage = document.createElement('img');
    tooltipImage.src = tooltipImageUrl.startsWith('/')
      ? `${window.location.origin}${tooltipImageUrl}`
      : tooltipImageUrl;
    tooltipImage.style.display = 'block';
    tooltipImage.style.maxWidth = '100px'; // Adjust as needed
    tooltipImage.style.marginTop = '5px';
    tooltip.appendChild(tooltipImage);
  }

  document.body.appendChild(tooltip);

  // Add event listeners for tooltip visibility
  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - fgX;
    const mouseY = e.clientY - rect.top - fgY;

    if (isMouseOverVisiblePixel(fgImage, mouseX, mouseY, fgWidth, fgHeight)) {
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
      tooltip.style.visibility = 'visible';
      tooltip.style.opacity = '1';
    } else {
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '0';
    }
  });

  element.addEventListener('mouseleave', () => {
    tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';
  });
}

function isMouseOverVisiblePixel(image, x, y, width, height) {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;

  // Create an off-screen canvas to get image pixel data
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const pixel = context.getImageData(x, y, 1, 1).data; // Get the pixel data at (x, y)
  return pixel[3] !== 0; // Check if the alpha channel is non-transparent
}
