# frozen_string_literal: true

require "rails_helper"

RSpec.describe DiscourseProjectUniform::UniformsController, type: :request do
  fab!(:user) { Fabricate(:user) }

  let(:renderer_key) { "renderer-secret-key" }
  let(:cache_key) { DiscourseProjectUniform::UniformSnapshot.cache_key_for_user(user) }
  let(:png_bytes) { "\x89PNG\r\n\x1A\nTEST".b }
  let(:data_url) do
    prefix = DiscourseProjectUniform::UniformSnapshot::DATA_URL_PREFIX
    "#{prefix}#{Base64.strict_encode64(png_bytes)}"
  end
  let(:renderer_headers) { { "HTTP_X_RENDERER_KEY" => renderer_key } }

  before do
    SiteSetting.discourse_project_uniform_enabled = true
    SiteSetting.discourse_project_uniform_public_enabled = true
    SiteSetting.discourse_project_uniform_renderer_key = renderer_key

    PluginStoreRow.where(plugin_name: DiscourseProjectUniform::UniformSnapshot::STORE_NAMESPACE).delete_all
    PluginStoreRow.where(plugin_name: DiscourseProjectUniform::UniformSnapshot::META_NAMESPACE).delete_all
  end

  describe "GET /uniform/:username/token" do
    it "rejects anonymous requests" do
      get "/uniform/#{user.username}/token"

      expect(response.status).to eq(403)
      expect(response.parsed_body["error"]).to eq("forbidden")
    end

    it "allows requests with the renderer key" do
      get "/uniform/#{user.username}/token", headers: renderer_headers

      expect(response.status).to eq(200)
      expect(response.parsed_body["token"]).to be_present
      expect(response.parsed_body["cache_key"]).to be_present
    end

    it "allows requests for the profile owner" do
      sign_in(user)

      get "/uniform/#{user.username}/token"

      expect(response.status).to eq(200)
      expect(response.parsed_body["token"]).to be_present
    end
  end

  describe "POST /uniform/:username/snapshot" do
    it "rejects anonymous uploads" do
      post "/uniform/#{user.username}/snapshot", params: { snapshot: { cache_key: cache_key, data: data_url } }

      expect(response.status).to eq(403)
      expect(response.parsed_body["error"]).to eq("forbidden")
    end

    it "rejects malformed base64 payloads" do
      invalid_data = "#{DiscourseProjectUniform::UniformSnapshot::DATA_URL_PREFIX}@@@"

      post "/uniform/#{user.username}/snapshot",
           params: { snapshot: { cache_key: cache_key, data: invalid_data } },
           headers: renderer_headers

      expect(response.status).to eq(422)
      expect(response.parsed_body["error"]).to eq("invalid_base64")
    end

    it "accepts uploads with the renderer key" do
      post "/uniform/#{user.username}/snapshot",
           params: { snapshot: { cache_key: cache_key, data: data_url } },
           headers: renderer_headers

      expect(response.status).to eq(200)
      expect(DiscourseProjectUniform::UniformSnapshot.fetch(user.id, cache_key)).to eq(png_bytes)
    end

    it "accepts signed uploads from the profile owner" do
      sign_in(user)

      get "/uniform/#{user.username}/token"
      token = response.parsed_body["token"]

      post "/uniform/#{user.username}/snapshot",
           params: { snapshot: { cache_key: cache_key, data: data_url } },
           headers: { "HTTP_X_UNIFORM_TOKEN" => token }

      expect(response.status).to eq(200)
      expect(DiscourseProjectUniform::UniformSnapshot.fetch(user.id, cache_key)).to eq(png_bytes)
    end
  end
end
