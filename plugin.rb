# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.10.0
# authors: OpenAI & Darojax
# url: https://github.com/16AA-Milsim/discourse-project-uniform

require "digest"
require_dependency "jobs/base"

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

  module RecruitNumber
    extend self

    RANGE = (100..999).freeze
    MUTEX_NAME = "discourse-project-uniform:recruit-number".freeze
    STORE_NAMESPACE = "discourse-project-uniform".freeze
    FORWARD_PREFIX = "recruit-number:uid:".freeze
    REVERSE_PREFIX = "recruit-number:code:".freeze

    def number_for(user)
      return nil unless user
      return nil unless recruit_group_member?(user)

      with_mutex do
        user_key = user.id.to_s
        existing = store.get(forward_key(user_key))
        return format_code(existing) if existing.present?

        candidate = initial_candidate(user)
        assigned = ensure_unique_number(candidate, user_key)
        code = format_code(assigned)

        store.set(forward_key(user_key), code)
        store.set(reverse_key(code), user_key)
        code
      end
    end

    private

    def store
      @store ||= PluginStore.new(STORE_NAMESPACE)
    end

    def forward_key(user_key)
      "#{FORWARD_PREFIX}#{user_key}"
    end

    def reverse_key(code)
      "#{REVERSE_PREFIX}#{code}"
    end

    def recruit_group
      @recruit_group ||= Group
        .where("LOWER(name) = ?", "recruit")
        .select(:id)
        .first
    end

    def recruit_group_member?(user)
      group = recruit_group
      return false unless group

      GroupUser.exists?(user_id: user.id, group_id: group.id)
    end

    def with_mutex(&block)
      DistributedMutex.synchronize(MUTEX_NAME, &block)
    end

    def initial_candidate(user)
      seed = "#{user.id}-#{user.username_lower || user.username || ''}-#{user.created_at.to_i}"
      digest = Digest::SHA1.hexdigest(seed)
      RANGE.begin + (digest.to_i(16) % RANGE.size)
    end

    def ensure_unique_number(start_value, user_key)
      range = RANGE.to_a
      start_index = range.index(start_value) || 0
      ordered = range.slice(start_index, range.length) + range.slice(0, start_index)

      ordered.each do |candidate|
        code = format_code(candidate)
        owner = store.get(reverse_key(code))
        return candidate if owner.blank? || owner.to_s == user_key

        owner_user = User.find_by(id: owner)
        unless owner_user && recruit_group_member?(owner_user)
          store.delete(forward_key(owner))
          store.delete(reverse_key(code))
          Rails.logger.info(
            "[discourse-project-uniform] reassigning recruit number #{code} from inactive user_id=#{owner}"
          )
          return candidate
        end
      end

      raise Discourse::InvalidParameters.new("No recruit numbers available for assignment")
    end

    def format_code(value)
      return nil if value.blank?
      number = value.to_i
      format("%03d", number)
    end

    def cleanup_stale_entries!
      with_mutex do
        PluginStoreRow
          .where(plugin_name: STORE_NAMESPACE)
          .where("key LIKE ?", "#{FORWARD_PREFIX}%")
          .find_each do |row|
            user_key = row.key.delete_prefix(FORWARD_PREFIX)
            next if user_key.blank?
            next if User.exists?(id: user_key)

            code = store.get(row.key)
            store.delete(row.key)

            formatted = format_code(code)
            store.delete(reverse_key(formatted)) if formatted
            Rails.logger.info(
              "[discourse-project-uniform] cleaned recruit number #{formatted} for missing user_id=#{user_key}"
            )
          end
      end
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

  add_to_serializer(:user, :project_uniform_recruit_number) do
    ::DiscourseProjectUniform::RecruitNumber.number_for(object)
  end

  module ::Jobs
    class CleanupProjectUniformRecruitNumbers < ::Jobs::Scheduled
      every 1.day

      def execute(_args)
        ::DiscourseProjectUniform::RecruitNumber.cleanup_stale_entries!
      rescue => e
        Rails.logger.warn("[discourse-project-uniform] cleanup job failed: #{e.message}")
      end
    end
  end

  # Safer to keep custom routes inside after_initialize
  Discourse::Application.routes.append do
    get "/admin/plugins/discourse-project-uniform" => "admin/site_settings#index",
        constraints: StaffConstraint.new,
        defaults: { filter: "discourse project uniform" }
  end
end
