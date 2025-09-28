# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.9.1
# authors: OpenAI & Darojax
# url: https://github.com/16AA-Milsim/discourse-project-uniform

require "digest"

enabled_site_setting :discourse_project_uniform_enabled

add_admin_route "discourse_project_uniform.title", "discourse-project-uniform"
register_asset "stylesheets/canvas-tooltip.scss"

after_initialize do
  # Precompute a combined cache key so the ?v= param on every asset changes
  # whenever the plugin version OR any image bytes under /public/images change.
  # This lets browsers keep a hot cache while guaranteeing fresh art after
  # deployments.
  plugin = Discourse.plugins.find { |p| p.name == "discourse-project-uniform" }

  plugin_root =
    if plugin&.path.present?
      plugin.path
    else
      # Fallback to the directory above this file when the plugin registry
      # has not been fully initialised (e.g. during asset precompilation).
      File.expand_path("..", __dir__)
    end

  images_path = File.join(plugin_root, "public", "images")

  image_cache_digest = begin
    if Dir.exist?(images_path)
      digest = Digest::SHA1.new
      Dir[File.join(images_path, "**", "*")].sort.each do |path|
        next unless File.file?(path)
        relative = path.delete_prefix("#{images_path}/")
        digest.update(relative)
        digest.update(Digest::SHA1.file(path).digest)
      end
      digest.hexdigest
    end
  rescue => e
    Rails.logger.warn("[discourse-project-uniform] cache digest error: #{e.message}")
    nil
  end

  project_uniform_cache_key = begin
    components = [plugin&.metadata&.version, image_cache_digest].compact
    if components.any?
      components.join("-")
    else
      # Ensure we still bust caches even if digest calculation fails for any
      # reason (e.g. permissions); this prevents serving stale assets.
      "fallback-#{Time.now.to_i}"
    end
  end

  # Expose plugin version to JS via Site serializer (safe across Discourse versions)
  add_to_serializer(:site, :project_uniform_version) do
    plugin&.metadata&.version
  end

  add_to_serializer(:site, :project_uniform_cache_key) do
    project_uniform_cache_key
  end

  # Safer to keep custom routes inside after_initialize
  Discourse::Application.routes.append do
    get "/admin/plugins/discourse-project-uniform" => "admin/site_settings#index",
        constraints: StaffConstraint.new,
        defaults: { filter: "discourse project uniform" }
  end
end
