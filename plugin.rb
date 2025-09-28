# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.9.1
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

    def directory_signature
      base = images_path
      return nil unless Dir.exist?(base)

      Dir[File.join(base, "**", "*")].filter_map do |path|
        next unless File.file?(path)
        File.mtime(path).to_f
      end.max
    rescue => e
      Rails.logger.warn("[discourse-project-uniform] cache signature error: #{e.message}")
      nil
    end

    def compute_digest
      base = images_path
      return nil unless Dir.exist?(base)

      digest = Digest::SHA1.new
      Dir[File.join(base, "**", "*")].sort.each do |path|
        next unless File.file?(path)
        relative = path.delete_prefix("#{base}/")
        digest.update(relative)
        digest.update(Digest::SHA1.file(path).digest)
      end
      digest.hexdigest
    rescue => e
      Rails.logger.warn("[discourse-project-uniform] cache digest error: #{e.message}")
      nil
    end

    def build_key(signature)
      components = []
      version = plugin_version
      components << version if version
      digest = compute_digest

      if digest
        components << digest
      elsif signature
        components << "sig-#{signature.to_i}"
      end

      if components.any?
        components.join("-")
      else
        "fallback-#{Time.now.to_i}"
      end
    end

    def current
      mutex.synchronize do
        signature = directory_signature
        cache = @cache
        if cache && cache[:signature] == signature && cache[:key]
          return cache[:key]
        end

        key = build_key(signature)
        @cache = { signature: signature, key: key }
        key
      end
    end

    def reset!
      mutex.synchronize { @cache = nil }
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

  # Safer to keep custom routes inside after_initialize
  Discourse::Application.routes.append do
    get "/admin/plugins/discourse-project-uniform" => "admin/site_settings#index",
        constraints: StaffConstraint.new,
        defaults: { filter: "discourse project uniform" }
  end
end
