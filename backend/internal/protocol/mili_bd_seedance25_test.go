package protocol

import (
	"context"
	"strings"
	"testing"
)

func TestMiliBDSeedance25CreatePollAndResult(t *testing.T) {
	adapter := officialPackageAdapter(t, "mili-bd-seedance25.yingce-plugin", "mili-bd-seedance25")
	request := GenerationRequest{
		Model:       "BD Seedance2.5",
		Prompt:      "镜头缓缓推进，晨光照在湖边的木船上。",
		Duration:    5,
		AspectRatio: "16:9",
		Resolution:  "720p",
		Images:      []MediaReference{{Name: "reference.png", URL: "https://cdn.example/reference.png"}},
		Videos:      []MediaReference{{Name: "source.mp4", DataURL: "data:video/mp4;base64,AAAA", Metadata: map[string]any{"durationMs": 2500}}},
		Audios:      []MediaReference{{Name: "music.mp3", URL: "https://cdn.example/music.mp3", Metadata: map[string]any{"seconds": 4}}},
		Extra:       map[string]any{"idempotencyKey": "mili-test-key"},
	}
	create, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	if create.Method != "POST" || create.Path != "/v1/videos" || create.ContentType != "application/json" || create.Auth.Type != "bearer" {
		t.Fatalf("create = %#v", create)
	}
	if create.Headers["Idempotency-Key"] != "mili-test-key" {
		t.Fatalf("create headers = %#v", create.Headers)
	}
	body := manifestTestBody(t, create)
	if body["model"] != request.Model || body["prompt"] != request.Prompt || body["seconds"] != float64(5) || body["ratio"] != "16:9" || body["resolution"] != "720p" {
		t.Fatalf("create body = %#v", body)
	}
	images := body["images"].([]any)
	if len(images) != 1 || images[0].(map[string]any)["name"] != "reference.png" || images[0].(map[string]any)["url"] != "https://cdn.example/reference.png" {
		t.Fatalf("images = %#v", images)
	}
	videos := body["videos"].([]any)
	if len(videos) != 1 || videos[0].(map[string]any)["name"] != "source.mp4" || videos[0].(map[string]any)["data"] != "AAAA" || videos[0].(map[string]any)["seconds"] != 2.5 {
		t.Fatalf("videos = %#v", videos)
	}
	audios := body["audios"].([]any)
	if len(audios) != 1 || audios[0].(map[string]any)["url"] != "https://cdn.example/music.mp3" || audios[0].(map[string]any)["seconds"] != float64(4) {
		t.Fatalf("audios = %#v", audios)
	}

	defaults, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{Prompt: "默认值"}})
	if err != nil {
		t.Fatal(err)
	}
	defaultBody := manifestTestBody(t, defaults)
	if defaultBody["model"] != "bd-seedance2.5" || defaultBody["seconds"] != float64(30) || defaultBody["ratio"] != "auto" || defaultBody["resolution"] != "720p" {
		t.Fatalf("default body = %#v", defaultBody)
	}

	customModel := "vendor-model-v99"
	customModelRequest, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{Model: customModel, Prompt: "valid", Duration: 5}})
	if err != nil {
		t.Fatalf("custom model was rejected: %v", err)
	}
	if model := manifestTestBody(t, customModelRequest)["model"]; model != customModel {
		t.Fatalf("custom model = %#v, want %q", model, customModel)
	}

	created, err := adapter.ParseCreate(context.Background(), []byte(`{"id":"mili-task-1","status":"queued"}`))
	if err != nil || created.TaskID != "mili-task-1" || created.Status != StatusPending {
		t.Fatalf("created = %#v err=%v", created, err)
	}
	poll, err := adapter.BuildPoll(context.Background(), PollContext{TaskID: created.TaskID})
	if err != nil || poll.Method != "GET" || poll.Path != "/v1/videos/mili-task-1" {
		t.Fatalf("poll = %#v err=%v", poll, err)
	}
	for _, tc := range []struct {
		name, payload string
		status        Status
	}{
		{name: "processing", payload: `{"id":"mili-task-1","status":"in_progress"}`, status: StatusProcessing},
		{name: "completed", payload: `{"id":"mili-task-1","status":"completed","video_url":"https://cdn.example/output.mp4"}`, status: StatusSucceeded},
		{name: "failed", payload: `{"id":"mili-task-1","status":"failed","error":{"message":"render failed"}}`, status: StatusFailed},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: "mili-task-1"}, []byte(tc.payload))
			if err != nil || result.Status != tc.status {
				t.Fatalf("result = %#v err=%v", result, err)
			}
			if tc.status == StatusSucceeded {
				if result.Result == nil || len(result.Result.Videos) != 1 || result.Result.Videos[0].URL != "https://cdn.example/output.mp4" || !result.Result.Videos[0].Ephemeral {
					t.Fatalf("success result = %#v", result)
				}
			}
			if tc.status == StatusFailed && result.Message != "render failed" {
				t.Fatalf("failure message = %#v", result)
			}
		})
	}

	resultAdapter, ok := adapter.(ResultAdapter)
	if !ok {
		t.Fatal("mili BD Seedance2.5 does not implement ResultAdapter")
	}
	result, err := resultAdapter.BuildResult(context.Background(), PollContext{TaskID: "mili-task-1"})
	if err != nil || result.Method != "GET" || result.Path != "/v1/videos/mili-task-1/content" || result.Query["download"][0] != "1" || result.Headers["Accept"] != "video/mp4" {
		t.Fatalf("result request = %#v err=%v", result, err)
	}
}

func TestMiliBDSeedance25Validations(t *testing.T) {
	adapter := officialPackageAdapter(t, "mili-bd-seedance25.yingce-plugin", "mili-bd-seedance25")
	valid := GenerationRequest{Prompt: "valid", Duration: 5}
	cases := []struct {
		name string
		edit func(*GenerationRequest)
	}{
		{name: "empty prompt", edit: func(r *GenerationRequest) { r.Prompt = " " }},
		{name: "prompt too long", edit: func(r *GenerationRequest) { r.Prompt = strings.Repeat("x", 45001) }},
		{name: "duration too short", edit: func(r *GenerationRequest) { r.Duration = 3 }},
		{name: "duration too long", edit: func(r *GenerationRequest) { r.Duration = 31 }},
		{name: "multimedia needs five seconds", edit: func(r *GenerationRequest) {
			r.Duration = 4
			r.Videos = []MediaReference{{URL: "https://cdn.example/ref.mp4"}}
		}},
		{name: "too many images", edit: func(r *GenerationRequest) { r.Images = make([]MediaReference, 31) }},
		{name: "too many videos", edit: func(r *GenerationRequest) { r.Videos = make([]MediaReference, 11) }},
		{name: "too many audios", edit: func(r *GenerationRequest) { r.Audios = make([]MediaReference, 11) }},
		{name: "too many total media", edit: func(r *GenerationRequest) {
			r.Images = make([]MediaReference, 20)
			r.Videos = make([]MediaReference, 10)
			r.Audios = make([]MediaReference, 1)
		}},
		{name: "invalid ratio", edit: func(r *GenerationRequest) { r.AspectRatio = "2:1" }},
		{name: "invalid resolution", edit: func(r *GenerationRequest) { r.Resolution = "1080p" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			request := valid
			tc.edit(&request)
			if _, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request}); err == nil {
				t.Fatal("BuildCreate succeeded for invalid request")
			}
		})
	}
}
