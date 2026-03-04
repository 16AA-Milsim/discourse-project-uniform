# frozen_string_literal: true

require "rails_helper"

RSpec.describe Jobs::RenderProjectUniformSnapshot do
  fab!(:user) { Fabricate(:user, staged: false) }

  before do
    SiteSetting.discourse_project_uniform_enabled = true
    SiteSetting.discourse_project_uniform_public_enabled = true
    SiteSetting.discourse_project_uniform_renderer_url = "http://127.0.0.1:3011/render"
  end

  it "stores an unrenderable placeholder snapshot when renderer returns no uniform canvas" do
    cache_key = DiscourseProjectUniform::UniformSnapshot.cache_key_for_user(user)
    visit_url = "http://example.test/uniform/#{user.username_lower}"
    placeholder = "\x89PNG\r\n\x1A\nUNRENDERABLE".b

    allow(DiscourseProjectUniform::UniformSnapshot).to receive(:render_snapshot_via_sidecar)
      .with(visit_url)
      .and_return(:unrenderable)

    expect(DiscourseProjectUniform::UniformSnapshot).to receive(:placeholder_png)
      .with(visit_url, reason: :unrenderable)
      .and_return(placeholder)

    expect(DiscourseProjectUniform::UniformSnapshot).to receive(:store_snapshot)
      .with(user.id, cache_key, placeholder)
      .and_return(true)

    described_class.new.execute(user_id: user.id, cache_key: cache_key, visit_url: visit_url)
  end
end
