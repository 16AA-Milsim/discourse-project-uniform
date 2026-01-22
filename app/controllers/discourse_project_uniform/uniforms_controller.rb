# frozen_string_literal: true

module DiscourseProjectUniform
  class UniformsController < ::ApplicationController
    skip_before_action :check_xhr
    skip_before_action :verify_authenticity_token, only: [:snapshot]
    skip_before_action :redirect_to_login_if_required, :redirect_to_profile_if_required

    before_action :ensure_plugin_enabled
    before_action :normalize_username_param

    def show
      user = find_user
      raise Discourse::NotFound if user.blank?

      render html: "", layout: "application"
    end

    def image
      user = find_user
      raise Discourse::NotFound if user.blank?

      cache_key = ::DiscourseProjectUniform::CacheKey.current
      snapshot = ::DiscourseProjectUniform::UniformSnapshot.fetch(user.id, cache_key)
      if snapshot.blank?
        visit_url = uniform_visit_url(user)
        placeholder = ::DiscourseProjectUniform::UniformSnapshot.placeholder_png(visit_url)
        if placeholder.present?
          placeholder = placeholder.b
          etag = Digest::SHA1.hexdigest("missing-#{visit_url}")
          return unless stale?(etag: etag, public: true)

          expires_in 5.minutes, public: true
          return send_data placeholder,
                           type: "image/png",
                           disposition: "inline",
                           filename: "uniform-missing-#{user.username}.png"
        end

        raise Discourse::NotFound
      end

      snapshot = snapshot.b
      etag = Digest::SHA1.hexdigest(snapshot)
      return unless stale?(etag: etag, public: true)

      expires_in 10.minutes, public: true
      send_data snapshot,
                type: "image/png",
                disposition: "inline",
                filename: "project-uniform-#{user.username}.png"
    end

    def token
      user = find_user
      raise Discourse::NotFound if user.blank?

      cache_key = ::DiscourseProjectUniform::CacheKey.current
      token = ::DiscourseProjectUniform::UniformSnapshot.signature_for(user.id, cache_key)
      render json: { token: token, cache_key: cache_key }
    end

    def snapshot
      user = find_user
      raise Discourse::NotFound if user.blank?

      cache_key = params.dig(:snapshot, :cache_key).presence || params[:cache_key].to_s
      cache_key = ::DiscourseProjectUniform::CacheKey.current if cache_key.blank?

      token = params.dig(:snapshot, :token).presence || params[:token].to_s
      token = request.headers["X-Uniform-Token"].to_s if token.blank?
      token = request.headers["X-Project-Uniform-Token"].to_s if token.blank?
      expected = ::DiscourseProjectUniform::UniformSnapshot.signature_for(user.id, cache_key)
      unless token.present? && ActiveSupport::SecurityUtils.secure_compare(token, expected)
        return render json: { error: "invalid_token" }, status: 403
      end

      png_bytes =
        if request.media_type == "image/png"
          request.raw_post
        else
          data_url = params.dig(:snapshot, :data)
          unless data_url.is_a?(String) && data_url.start_with?(::DiscourseProjectUniform::UniformSnapshot::DATA_URL_PREFIX)
            return render json: { error: "invalid_data" }, status: 422
          end

          encoded = data_url.delete_prefix(::DiscourseProjectUniform::UniformSnapshot::DATA_URL_PREFIX)
          if encoded.length > ::DiscourseProjectUniform::UniformSnapshot.max_base64_length
            return render json: { error: "payload_too_large" }, status: 413
          end

          begin
            Base64.decode64(encoded)
          rescue ArgumentError
            return render json: { error: "invalid_base64" }, status: 422
          end
        end

      if png_bytes.blank?
        return render json: { error: "invalid_png" }, status: 422
      end

      if png_bytes.bytesize > ::DiscourseProjectUniform::UniformSnapshot::MAX_PNG_BYTES
        return render json: { error: "payload_too_large" }, status: 413
      end

      unless ::DiscourseProjectUniform::UniformSnapshot.store_snapshot(user.id, cache_key, png_bytes)
        return render json: { error: "store_failed" }, status: 422
      end

      render json: success_json
    end

    private

    def ensure_plugin_enabled
      raise Discourse::NotFound unless SiteSetting.discourse_project_uniform_enabled
      # Public endpoints are still experimental and locked off for now.
      raise Discourse::NotFound unless ::DiscourseProjectUniform.public_uniforms_enabled?
    end

    def find_user
      username = params[:username].to_s
      return nil if username.blank?

      User.find_by_username(username)
    end

    def normalize_username_param
      raw = params[:username].to_s
      return if raw.blank?

      normalized = User.normalize_username(raw)
      return if normalized.blank?

      params[:username] = normalized
    end

    def uniform_visit_url(user)
      base = resolve_public_base_url
      base = base.to_s.chomp("/")
      "#{base}/uniform/#{user.username}"
    end

    def resolve_public_base_url
      forwarded_host = request.headers["X-Forwarded-Host"].presence
      if forwarded_host
        scheme = request.headers["X-Forwarded-Proto"].presence || request.protocol
        return "#{scheme}://#{forwarded_host}"
      end

      origin = request.headers["Origin"].presence
      if origin
        begin
          uri = URI.parse(origin)
          if uri.scheme.present? && uri.host.present?
            return build_base_url(uri)
          end
        rescue URI::InvalidURIError
          # ignore
        end
      end

      referer = request.headers["Referer"].presence
      if referer
        begin
          uri = URI.parse(referer)
          if uri.scheme.present? && uri.host.present?
            return build_base_url(uri)
          end
        rescue URI::InvalidURIError
          # ignore
        end
      end

      Discourse.base_url.to_s
    end

    def build_base_url(uri)
      port =
        if uri.port && ![80, 443].include?(uri.port)
          ":#{uri.port}"
        else
          ""
        end
      "#{uri.scheme}://#{uri.host}#{port}"
    end
  end
end
