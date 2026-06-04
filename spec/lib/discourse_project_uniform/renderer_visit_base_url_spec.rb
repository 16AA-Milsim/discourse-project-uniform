# frozen_string_literal: true

require "rails_helper"

RSpec.describe DiscourseProjectUniform do
  describe ".renderer_visit_base_url" do
    let(:original_value) { SiteSetting.discourse_project_uniform_renderer_visit_base_url }

    after do
      SiteSetting.discourse_project_uniform_renderer_visit_base_url = original_value
    end

    it "normalizes configured HTTP(S) URLs" do
      SiteSetting.discourse_project_uniform_renderer_visit_base_url = "https://forum.example.com/path?q=1"

      expect(described_class.renderer_visit_base_url).to eq("https://forum.example.com")
    end

    it "falls back to Discourse.base_url for invalid schemes" do
      SiteSetting.discourse_project_uniform_renderer_visit_base_url = "javascript:alert(1)"

      expect(described_class.renderer_visit_base_url).to eq(Discourse.base_url.to_s)
    end
  end
end
