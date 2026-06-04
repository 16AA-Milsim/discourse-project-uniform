# frozen_string_literal: true

require "rails_helper"

RSpec.describe Jobs::PrewarmProjectUniformSnapshots do
  fab!(:user_a) { Fabricate(:user, staged: false) }
  fab!(:user_b) { Fabricate(:user, staged: false) }

  let(:store) { PluginStore.new(DiscourseProjectUniform::PREWARM_NAMESPACE) }

  before do
    SiteSetting.discourse_project_uniform_enabled = true
    SiteSetting.discourse_project_uniform_public_enabled = true
    SiteSetting.discourse_project_uniform_renderer_url = "http://127.0.0.1:3011/render"
    SiteSetting.discourse_project_uniform_snapshot_prewarm_enabled = true
    SiteSetting.discourse_project_uniform_snapshot_prewarm_batch_size = 10

    PluginStoreRow.where(plugin_name: DiscourseProjectUniform::PREWARM_NAMESPACE).delete_all
    PluginStoreRow.where(plugin_name: DiscourseProjectUniform::UniformSnapshot::STORE_NAMESPACE).delete_all
    PluginStoreRow.where(plugin_name: DiscourseProjectUniform::UniformSnapshot::META_NAMESPACE).delete_all
  end

  it "warms snapshots in batches and advances the prewarm cursor" do
    enqueued_user_ids = []
    allow(DiscourseProjectUniform::UniformSnapshot).to receive(:enqueue_render!) do |args|
      enqueued_user_ids << args[:user_id]
      true
    end

    described_class.new.execute({})
    described_class.new.execute({})

    expect(enqueued_user_ids).to include(user_a.id, user_b.id)
    expect(store.get(DiscourseProjectUniform::PREWARM_CURSOR_KEY).to_i).to be > 0
  end

  it "skips users that already have a snapshot for the current cache key" do
    cache_key = DiscourseProjectUniform::UniformSnapshot.cache_key_for_user(user_a)
    png = "\x89PNG\r\n\x1A\nPREWARM".b
    expect(DiscourseProjectUniform::UniformSnapshot.store_snapshot(user_a.id, cache_key, png)).to eq(true)

    enqueued_user_ids = []
    allow(DiscourseProjectUniform::UniformSnapshot).to receive(:enqueue_render!) do |args|
      enqueued_user_ids << args[:user_id]
      true
    end

    described_class.new.execute({})
    described_class.new.execute({})

    expect(enqueued_user_ids).to include(user_b.id)
    expect(enqueued_user_ids).not_to include(user_a.id)
  end
end
