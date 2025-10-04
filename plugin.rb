# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.9.8
# authors: OpenAI & Darojax
# url: https://github.com/16AA-Milsim/discourse-project-uniform

require "digest"

module ::DiscourseProjectUniform
  module CacheKey
    extend self

    def mutex
      @mutex ||= Mutex.new
    end

    def plugin
      Discourse.plugins.find { |p| p.name == "discourse-project-uniform" }
    end

    def plugin_version
      plugin&.metadata&.version
    end

    def plugin_root
      if plugin&.path.present?
        plugin.path
      else
        # Fallback when plugin registry has not been initialised (e.g. asset precompile)
        File.expand_path("..", __dir__)
      end
    end

    def images_path
      File.join(plugin_root, "public", "images")
    end

    def snapshot
      mutex.synchronize do
        @snapshot ||= compute_snapshot
      end
    end

    def compute_snapshot
      base = images_path
      digest = Digest::SHA1.new
      assets = Hash.new { |hash, key| hash[key] = {} }

      if Dir.exist?(base)
        Dir[File.join(base, "**", "*")].sort.each do |path|
          next unless File.file?(path)

          relative = path.delete_prefix("#{base}/")
          category, file_name = relative.split("/", 2)
          next unless category && file_name

          file_digest = Digest::SHA1.file(path).hexdigest
          assets[category][file_name] = file_digest

          digest.update(relative)
          digest.update(file_digest)
        end
      end

      aggregated_key = build_key(digest, assets)
      { key: aggregated_key, assets: finalize_assets(assets) }
    rescue => e
      Rails.logger.warn("[discourse-project-uniform] cache digest error: #{e.message}")
      { key: fallback_key, assets: {} }
    end

    def finalize_assets(assets)
      assets.each_with_object({}) do |(category, files), result|
        result[category] = files.dup
      end
    end

    def fallback_key
      "fallback-#{Time.now.to_i}"
    end

    def build_key(digest, assets)
      components = []
      version = plugin_version
      components << version if version

      unless assets.empty?
        components << digest.hexdigest
      end

      if components.any?
        components.join("-")
      else
        fallback_key
      end
    end

    def current
      snapshot[:key]
    end

    def assets_tokens
      snapshot[:assets].each_with_object({}) do |(category, files), result|
        result[category] = files.dup
      end
    end

    def reset!
      mutex.synchronize { @snapshot = nil }
    end
  end
end

enabled_site_setting :discourse_project_uniform_enabled

add_admin_route "discourse_project_uniform.title", "discourse-project-uniform"
register_asset "stylesheets/canvas-tooltip.scss"

after_initialize do
  # Expose plugin version to JS via Site serializer (safe across Discourse versions)
  add_to_serializer(:site, :project_uniform_version) do
    ::DiscourseProjectUniform::CacheKey.plugin_version
  end

  add_to_serializer(:site, :project_uniform_cache_key) do
    ::DiscourseProjectUniform::CacheKey.current
  end

  add_to_serializer(:site, :project_uniform_asset_tokens) do
    ::DiscourseProjectUniform::CacheKey.assets_tokens
  end

  # Safer to keep custom routes inside after_initialize
  Discourse::Application.routes.append do
    get "/admin/plugins/discourse-project-uniform" => "admin/site_settings#index",
        constraints: StaffConstraint.new,
        defaults: { filter: "discourse project uniform" }
  end
end
