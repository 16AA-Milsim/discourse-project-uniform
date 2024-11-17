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
                  const backgroundImageUrl = formatUrl(Discourse.SiteSettings.project_uniform_image_upload);
                  const foregroundImageUrl = formatUrl(Discourse.SiteSettings.project_uniform_foreground_image_upload);

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
    if (imagesLoaded === 2) {
      // Set canvas size and draw images
      canvas.width = bgImage.naturalWidth || 1;
      canvas.height = bgImage.naturalHeight || 1;
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

      const fgWidth = fgImage.naturalWidth || 0;
      const fgHeight = fgImage.naturalHeight || 0;
      const fgX = (canvas.width - fgWidth) / 2;
      const fgY = (canvas.height - fgHeight) / 2;
      if (fgWidth > 0 && fgHeight > 0) {
        ctx.drawImage(fgImage, fgX, fgY, fgWidth, fgHeight);
      }

      // Display the merged image
      const mergedImage = createImageElement(canvas.toDataURL('image/png'), 'Merged Project Uniform Image');
      container.prepend(mergedImage);

      // Add tooltip if foreground image is present
      if (fgWidth > 0 && fgHeight > 0) {
        createTooltip(mergedImage, fgX, fgY, fgWidth, fgHeight);
      }
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

function createTooltip(element, fgX, fgY, fgWidth, fgHeight) {
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
  tooltip.style.transition = 'opacity 0.2s';
  tooltip.style.opacity = '0';

  // Optionally add an image to the tooltip if provided
  const tooltipImageUrl = Discourse.SiteSettings.project_uniform_tooltip_image;
  if (tooltipImageUrl) {
    const tooltipImage = document.createElement('img');
    tooltipImage.src = tooltipImageUrl.startsWith('/')
      ? `${window.location.origin}${tooltipImageUrl}`
      : tooltipImageUrl;
    tooltipImage.style.display = 'block';
    tooltipImage.style.maxWidth = '100px'; // Adjust the size as needed
    tooltipImage.style.marginTop = '5px';
    tooltip.appendChild(tooltipImage);
  }

  document.body.appendChild(tooltip);

  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseX >= fgX && mouseX <= fgX + fgWidth && mouseY >= fgY && mouseY <= fgY + fgHeight) {
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

