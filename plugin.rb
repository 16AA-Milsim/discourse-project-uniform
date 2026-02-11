# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.10.3
# authors: OpenAI & Darojax
# url: https://github.com/16AA-Milsim/discourse-project-uniform

require "digest"
require "base64"
require "openssl"
require_dependency "jobs/base"

module ::DiscourseProjectUniform
  # Public uniform endpoints are experimental and currently locked off while we
  # finalize the long-term snapshot strategy.
  PUBLIC_UNIFORMS_LOCKED = true

  def self.public_uniforms_enabled?
    return false if PUBLIC_UNIFORMS_LOCKED
    SiteSetting.discourse_project_uniform_public_enabled
  end

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

    def fonts_path
      File.join(plugin_root, "public", "fonts")
    end

    def snapshot
      mutex.synchronize do
        @snapshot ||= compute_snapshot
      end
    end

    def compute_snapshot
      digest = Digest::SHA1.new
      assets = Hash.new { |hash, key| hash[key] = {} }

      add_assets(images_path, assets, digest)
      add_assets(fonts_path, assets, digest, category: "fonts")

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

    private

    def add_assets(base, assets, digest, category: nil)
      return unless Dir.exist?(base)

      Dir[File.join(base, "**", "*")].sort.each do |path|
        next unless File.file?(path)

        relative = path.delete_prefix("#{base}/")
        if category
          category_name = category
          file_name = relative
        else
          category_name, file_name = relative.split("/", 2)
          next unless category_name && file_name
        end

        file_digest = Digest::SHA1.file(path).hexdigest
        assets[category_name][file_name] = file_digest

        digest.update("#{category_name}/#{file_name}")
        digest.update(file_digest)
      end
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
      if @recruit_group && Group.exists?(id: @recruit_group.id)
        return @recruit_group
      end

      @recruit_group = Group
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

  end

  module UniformSnapshot
    extend self

    STORE_NAMESPACE = "discourse-project-uniform-snapshots".freeze
    META_NAMESPACE = "discourse-project-uniform-snapshot-meta".freeze
    KEY_PREFIX = "snapshot:uid:".freeze
    DATA_URL_PREFIX = "data:image/png;base64,".freeze
    MAX_PNG_BYTES = 1_500_000
    SIGNING_SALT = "project-uniform-snapshot".freeze
    PLACEHOLDER_BG = [20, 22, 28].freeze
    PLACEHOLDER_FG = [255, 255, 255].freeze
    PLACEHOLDER_ACCENT = [152, 195, 121].freeze
    PRUNE_MUTEX = "discourse-project-uniform:snapshot-prune".freeze
    META_CACHE_KEY = "active-cache-key".freeze

    def fetch(user_id, cache_key)
      return nil if user_id.blank? || cache_key.blank?
      encoded = store.get(key(user_id, cache_key))
      return nil if encoded.blank?

      Base64.decode64(encoded)
    rescue ArgumentError
      nil
    end

    def store_snapshot(user_id, cache_key, png_bytes)
      return false if user_id.blank? || cache_key.blank?
      return false if png_bytes.blank?
      return false if png_bytes.bytesize > MAX_PNG_BYTES

      current_cache_key = ::DiscourseProjectUniform::CacheKey.current
      prune_stale_snapshots!(current_cache_key)

      encoded = Base64.strict_encode64(png_bytes)
      store.set(key(user_id, cache_key), encoded)
      true
    end

    def max_base64_length
      # base64 inflates size by ~4/3; pad to be safe
      ((MAX_PNG_BYTES * 4) / 3.0).ceil + 8
    end

    def signature_for(user_id, cache_key)
      secret = "#{Rails.application.secret_key_base}--#{SIGNING_SALT}"
      OpenSSL::HMAC.hexdigest("SHA256", secret, "#{user_id}:#{cache_key}")
    end

    def placeholder_png(visit_url)
      begin
        require "chunky_png"
      rescue LoadError => e
        Rails.logger.warn("[discourse-project-uniform] chunky_png unavailable: #{e.message}")
        return nil
      end

      safe_url =
        visit_url
          .to_s
          .encode("UTF-8", invalid: :replace, undef: :replace, replace: "")

      lines = [
        "UNIFORM PNG NOT GENERATED YET.",
        "VISIT THIS PAGE ONCE TO GENERATE IT:",
        safe_url
      ]

      font = placeholder_font
      char_width = 5
      char_height = 7
      spacing = 1
      line_spacing = 6
      margin = 16
      max_chars = 90

      wrapped = lines.flat_map { |line| wrap_text(line, max_chars) }
      max_len = wrapped.map(&:length).max || 0
      text_width = max_len.zero? ? 0 : (max_len * (char_width + spacing)) - spacing

      width = [620, text_width + margin * 2].max
      height = margin * 2 + wrapped.length * char_height + (wrapped.length - 1) * line_spacing

      bg = ChunkyPNG::Color.rgb(*PLACEHOLDER_BG)
      fg = ChunkyPNG::Color.rgb(*PLACEHOLDER_FG)
      accent = ChunkyPNG::Color.rgb(*PLACEHOLDER_ACCENT)

      image = ChunkyPNG::Image.new(width, height, bg)
      y = margin

      wrapped.each_with_index do |line, index|
        color = index == 2 ? accent : fg
        draw_text(image, line, margin, y, color, font, char_width, char_height, spacing)
        y += char_height + line_spacing
      end

      io = StringIO.new
      image.write(io)
      io.string.b
    rescue => e
      Rails.logger.warn("[discourse-project-uniform] placeholder png error: #{e.message}")
      nil
    end

    private

    def key(user_id, cache_key)
      "#{KEY_PREFIX}#{user_id}:#{cache_key}"
    end

    def store
      @store ||= PluginStore.new(STORE_NAMESPACE)
    end

    def meta_store
      @meta_store ||= PluginStore.new(META_NAMESPACE)
    end

    def extract_cache_key(raw_key)
      return nil if raw_key.blank?
      return nil unless raw_key.start_with?(KEY_PREFIX)

      suffix = raw_key.delete_prefix(KEY_PREFIX)
      _user_id, cache_key = suffix.split(":", 2)
      cache_key
    end

    def prune_stale_snapshots!(active_cache_key)
      return if active_cache_key.blank?

      DistributedMutex.synchronize(PRUNE_MUTEX) do
        previous = meta_store.get(META_CACHE_KEY)
        return if previous == active_cache_key

        removed = 0
        PluginStoreRow
          .where(plugin_name: STORE_NAMESPACE)
          .where("key LIKE ?", "#{KEY_PREFIX}%")
          .find_each do |row|
            cache_key = extract_cache_key(row.key)
            next if cache_key.blank? || cache_key == active_cache_key

            store.delete(row.key)
            removed += 1
          end

        meta_store.set(META_CACHE_KEY, active_cache_key)
        if removed.positive?
          Rails.logger.info(
            "[discourse-project-uniform] pruned #{removed} stale uniform snapshots (cache_key=#{active_cache_key})"
          )
        end
      end
    rescue => e
      Rails.logger.warn("[discourse-project-uniform] snapshot prune error: #{e.message}")
    end

    def wrap_text(text, max_chars)
      return [""] if text.nil?
      return [text] if text.length <= max_chars

      lines = []
      remaining = text.dup
      while remaining.length > max_chars
        lines << remaining.slice!(0, max_chars)
      end
      lines << remaining if remaining.present?
      lines
    end

    def draw_text(image, text, x, y, color, font, char_width, char_height, spacing)
      return if text.blank?

      text.to_s.each_char.with_index do |char, index|
        glyph = font[char] || font[char.upcase] || font["?"]
        next unless glyph

        draw_glyph(image, glyph, x + index * (char_width + spacing), y, color)
      end
    end

    def draw_glyph(image, glyph, x, y, color)
      glyph.each_with_index do |row, dy|
        row.each_char.with_index do |cell, dx|
          next unless cell == "1"
          image[x + dx, y + dy] = color
        end
      end
    end

    def placeholder_font
      @placeholder_font ||= {
        "A" => %w[01110 10001 10001 11111 10001 10001 10001],
        "B" => %w[11110 10001 10001 11110 10001 10001 11110],
        "C" => %w[01110 10001 10000 10000 10000 10001 01110],
        "D" => %w[11110 10001 10001 10001 10001 10001 11110],
        "E" => %w[11111 10000 10000 11110 10000 10000 11111],
        "F" => %w[11111 10000 10000 11110 10000 10000 10000],
        "G" => %w[01110 10001 10000 10000 10011 10001 01110],
        "H" => %w[10001 10001 10001 11111 10001 10001 10001],
        "I" => %w[11111 00100 00100 00100 00100 00100 11111],
        "J" => %w[00111 00010 00010 00010 00010 10010 01100],
        "K" => %w[10001 10010 10100 11000 10100 10010 10001],
        "L" => %w[10000 10000 10000 10000 10000 10000 11111],
        "M" => %w[10001 11011 10101 10101 10001 10001 10001],
        "N" => %w[10001 11001 10101 10011 10001 10001 10001],
        "O" => %w[01110 10001 10001 10001 10001 10001 01110],
        "P" => %w[11110 10001 10001 11110 10000 10000 10000],
        "Q" => %w[01110 10001 10001 10001 10101 10010 01101],
        "R" => %w[11110 10001 10001 11110 10100 10010 10001],
        "S" => %w[01111 10000 10000 01110 00001 00001 11110],
        "T" => %w[11111 00100 00100 00100 00100 00100 00100],
        "U" => %w[10001 10001 10001 10001 10001 10001 01110],
        "V" => %w[10001 10001 10001 10001 10001 01010 00100],
        "W" => %w[10001 10001 10001 10101 10101 10101 01010],
        "X" => %w[10001 10001 01010 00100 01010 10001 10001],
        "Y" => %w[10001 10001 01010 00100 00100 00100 00100],
        "Z" => %w[11111 00001 00010 00100 01000 10000 11111],
        "0" => %w[01110 10001 10011 10101 11001 10001 01110],
        "1" => %w[00100 01100 00100 00100 00100 00100 01110],
        "2" => %w[01110 10001 00001 00010 00100 01000 11111],
        "3" => %w[11110 00001 00001 01110 00001 00001 11110],
        "4" => %w[00010 00110 01010 10010 11111 00010 00010],
        "5" => %w[11111 10000 10000 11110 00001 00001 11110],
        "6" => %w[01110 10000 10000 11110 10001 10001 01110],
        "7" => %w[11111 00001 00010 00100 01000 01000 01000],
        "8" => %w[01110 10001 10001 01110 10001 10001 01110],
        "9" => %w[01110 10001 10001 01111 00001 00001 01110],
        ":" => %w[00000 00100 00100 00000 00100 00100 00000],
        "/" => %w[00001 00010 00100 00100 01000 10000 00000],
        "." => %w[00000 00000 00000 00000 00000 00100 00100],
        "-" => %w[00000 00000 00000 11111 00000 00000 00000],
        "_" => %w[00000 00000 00000 00000 00000 00000 11111],
        "?" => %w[01110 10001 00001 00010 00100 00000 00100],
        " " => %w[00000 00000 00000 00000 00000 00000 00000]
      }
    end
  end
end

enabled_site_setting :discourse_project_uniform_enabled

add_admin_route "discourse_project_uniform.title", "discourse-project-uniform", use_new_show_route: true
register_asset "stylesheets/canvas-tooltip.scss"
register_asset "stylesheets/admin/project-uniform-admin.scss", :admin

after_initialize do
  require_dependency File.expand_path("app/controllers/discourse_project_uniform/uniforms_controller", __dir__)

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

    class CleanupProjectUniformSnapshots < ::Jobs::Scheduled
      every 1.day

      def execute(_args)
        cache_key = ::DiscourseProjectUniform::CacheKey.current
        ::DiscourseProjectUniform::UniformSnapshot.send(:prune_stale_snapshots!, cache_key)
      rescue => e
        Rails.logger.warn("[discourse-project-uniform] snapshot cleanup job failed: #{e.message}")
      end
    end
  end

  if ::DiscourseProjectUniform::PUBLIC_UNIFORMS_LOCKED &&
       SiteSetting.discourse_project_uniform_public_enabled
    SiteSetting.discourse_project_uniform_public_enabled = false
  end

  on(:site_setting_changed) do |name, _old_value, _new_value|
    next unless name.to_s == "discourse_project_uniform_public_enabled"
    next unless ::DiscourseProjectUniform::PUBLIC_UNIFORMS_LOCKED

    SiteSetting.discourse_project_uniform_public_enabled = false
  end

  # Safer to keep custom routes inside after_initialize
  Discourse::Application.routes.append do
    get "/admin/plugins/discourse-project-uniform" => "admin/site_settings#index",
        constraints: StaffConstraint.new,
        defaults: { filter: "discourse project uniform" }

    get "/uniform/:username.png" => "discourse_project_uniform/uniforms#image",
        constraints: { username: RouteFormat.username, format: "png" }
    get "/uniform/:username" => "discourse_project_uniform/uniforms#show",
        constraints: { username: RouteFormat.username, format: "html" }
    get "/uniform/:username/token" => "discourse_project_uniform/uniforms#token",
        constraints: { username: RouteFormat.username }
    post "/uniform/:username/snapshot" => "discourse_project_uniform/uniforms#snapshot",
         constraints: { username: RouteFormat.username }
  end
end
