# frozen_string_literal: true

require "rails_helper"

RSpec.describe DiscourseProjectUniform::RecruitNumber do
  fab!(:recruit_group) { Fabricate(:group, name: "recruit") }
  fab!(:user) { Fabricate(:user) }

  before do
    described_class.instance_variable_set(:@recruit_group, nil)
    PluginStoreRow.where(plugin_name: described_class::STORE_NAMESPACE).delete_all
  end

  it "assigns a stable 3-digit recruit number" do
    GroupUser.create!(user: user, group: recruit_group)

    first = described_class.number_for(user)
    second = described_class.number_for(user)

    expect(first).to match(/\A\d{3}\z/)
    expect(second).to eq(first)
  end

  it "cleans stale recruit number mappings" do
    missing_id = User.maximum(:id).to_i + 1000
    code = "123"

    store = PluginStore.new(described_class::STORE_NAMESPACE)
    store.set("#{described_class::FORWARD_PREFIX}#{missing_id}", code)
    store.set("#{described_class::REVERSE_PREFIX}#{code}", missing_id.to_s)

    described_class.cleanup_stale_entries!

    expect(store.get("#{described_class::FORWARD_PREFIX}#{missing_id}")).to be_nil
    expect(store.get("#{described_class::REVERSE_PREFIX}#{code}")).to be_nil
  end
end
