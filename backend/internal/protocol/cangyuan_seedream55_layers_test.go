package protocol

import (
	"context"
	"testing"
)

func TestCangyuanSeedream55LayerPlugin(t *testing.T) {
	adapter := officialPackageAdapter(t, "cangyuan-seedream-55-layers.yingce-plugin", "cangyuan-seedream-55-layers")
	request := GenerationRequest{
		Capability: CapabilityImage,
		Model:      "doubao-seedream-5-5-261028",
		Prompt:     "拆开这张海报",
		Images:     []MediaReference{{URL: "https://example.com/poster.png"}},
		ImageParameters: map[string]any{
			"layerDecomposition": true,
			"maxImages":          8,
			"layerSize":          "auto",
			"textRecognition":    true,
			"outputFormat":       "png",
		},
	}
	create, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	if create.Path != "/v1/images/generations" {
		t.Fatalf("path = %q", create.Path)
	}
	body := manifestTestBody(t, create)
	if body["model"] != request.Model || body["n"] != float64(1) || body["size"] != "auto" || body["layer_decomposition"] != true {
		t.Fatalf("body = %#v", body)
	}
	if body["background"] != nil || body["output_format"] != "png" || body["async"] != false {
		t.Fatalf("body defaults = %#v", body)
	}
	options, ok := body["layer_decomposition_options"].(map[string]any)
	if !ok || manifestInt(options["max_images"]) != 8 || options["text_recognition"] != true {
		t.Fatalf("layer options = %#v", body["layer_decomposition_options"])
	}
	created, err := adapter.ParseCreate(context.Background(), []byte(`{"model":"doubao-seedream-5-5-261028","data":[{"url":"https://example.com/base.png","size":"1680x2496","z_index":0,"background":"opaque"},{"url":"https://example.com/layer.png","size":"709x370","z_index":4,"bounding_box":{"absolute":[590,1444,1081,1700],"normalized":[351,579,643,681]},"name":"文字层","text_recognition":{"text":"直播时间"},"background":"transparent"}],"usage":{"input_images":1,"generated_images":8,"output_tokens":33700,"total_tokens":33700}}`))
	if err != nil {
		t.Fatal(err)
	}
	if created.Result == nil || len(created.Result.Images) != 2 || created.Result.Usage["generated_images"] != float64(8) {
		t.Fatalf("parsed result = %#v", created)
	}
	layer := created.Result.Images[1]
	if layer.Metadata["z_index"] != float64(4) || layer.Name != "文字层" || layer.Metadata["text_recognition"].(map[string]any)["text"] != "直播时间" {
		t.Fatalf("layer metadata = %#v", layer.Metadata)
	}
}

func TestCangyuanSeedream55NormalSizeDefaults(t *testing.T) {
	adapter := officialPackageAdapter(t, "cangyuan-seedream-55-layers.yingce-plugin", "cangyuan-seedream-55-layers")
	create, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Capability:      CapabilityImage,
		Model:           "doubao-seedream-5-5-261028",
		Prompt:          "一只白猫",
		AspectRatio:     "16:9",
		ImageParameters: map[string]any{"outputFormat": "png"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	body := manifestTestBody(t, create)
	if body["size"] != "2560x1440" || body["output_format"] != "png" || body["optimize_prompt_options"] == nil {
		t.Fatalf("body = %#v", body)
	}
	request := GenerationRequest{
		Capability:      CapabilityImage,
		Model:           "doubao-seedream-5-5-261028",
		Prompt:          "白猫",
		ImageParameters: map[string]any{"background": "transparent", "outputFormat": "png"},
	}
	create, err = adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	if transparentBody := manifestTestBody(t, create); transparentBody["background"] != "transparent" {
		t.Fatalf("transparent body = %#v", transparentBody)
	}
	request.ImageParameters = map[string]any{"background": "transparent", "outputFormat": "jpeg"}
	if _, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request}); err == nil {
		t.Fatal("transparent background must reject jpeg output")
	}
}
