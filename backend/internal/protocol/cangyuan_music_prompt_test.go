package protocol

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestCangyuanMusicPromptCreateContract(t *testing.T) {
	adapter := officialPackageAdapter(t, "cangyuan-music-prompt.yingce-plugin", "cangyuan-music-prompt")
	for _, tc := range []struct {
		name        string
		options     map[string]any
		wantPresent bool
		wantValue   bool
	}{
		{name: "omitted"},
		{name: "true", options: map[string]any{"instrumental": true}, wantPresent: true, wantValue: true},
		{name: "false", options: map[string]any{"instrumental": false}, wantPresent: true, wantValue: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := GenerationRequest{Model: "su2-suno-v6", Prompt: "慢速爵士钢琴，雨夜，没有人声"}
			if tc.options != nil {
				request.ProviderOptions = map[string]map[string]any{"cangyuan-music-prompt": tc.options}
			}
			spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
			if err != nil {
				t.Fatal(err)
			}
			if spec.Method != "POST" || spec.Path != "/v1/music" {
				t.Fatalf("create spec = %#v", spec)
			}
			body := manifestTestBody(t, spec)
			if body["model"] != request.Model || body["prompt"] != request.Prompt || body["n"] != float64(1) {
				t.Fatalf("create body = %#v", body)
			}
			if value, ok := body["instrumental"]; ok != tc.wantPresent || (ok && value != tc.wantValue) {
				t.Fatalf("instrumental = %#v (present %v), want %#v (present %v)", value, ok, tc.wantValue, tc.wantPresent)
			}
			for _, forbidden := range []string{"lyrics", "style", "duration", "audio", "audios", "reference_audio"} {
				if _, ok := body[forbidden]; ok {
					t.Fatalf("unexpected %q in create body: %#v", forbidden, body)
				}
			}
		})
	}
}

func TestCangyuanMusicPromptPollAndAllResults(t *testing.T) {
	adapter := officialPackageAdapter(t, "cangyuan-music-prompt.yingce-plugin", "cangyuan-music-prompt")
	request := GenerationRequest{Model: "su2-suno-v6", Prompt: "instrumental jazz"}
	created, err := adapter.ParseCreate(context.Background(), []byte(`{"id":"task_42","object":"music.generation","status":"queued"}`))
	if err != nil || created.TaskID != "task_42" || created.Status != StatusPending {
		t.Fatalf("create = %#v, err = %v", created, err)
	}
	poll, err := adapter.BuildPoll(context.Background(), PollContext{Model: request.Model, Request: request, TaskID: created.TaskID})
	if err != nil || poll.Method != "GET" || poll.Path != "/v1/music/task_42" {
		t.Fatalf("poll = %#v, err = %v", poll, err)
	}
	completed, err := adapter.ParsePoll(context.Background(), PollContext{Model: request.Model, Request: request, TaskID: created.TaskID}, []byte(`{"id":"task_42","object":"music.generation","model":"su2-suno-v6","status":"completed","progress":"100%","created_at":1715923200,"music_url":["https://direct-api.cangyuansuanli.cn/media/a.mp3","https://direct-api.cangyuansuanli.cn/media/b.mp3"]}`))
	if err != nil || completed.Status != StatusSucceeded || completed.TaskID != created.TaskID || completed.Stage != "100%" || completed.Result == nil {
		t.Fatalf("poll result = %#v, err = %v", completed, err)
	}
	if len(completed.Result.Audios) != 2 {
		t.Fatalf("audio results = %#v", completed.Result.Audios)
	}
	gotURLs := []string{completed.Result.Audios[0].URL, completed.Result.Audios[1].URL}
	wantURLs := []string{"https://direct-api.cangyuansuanli.cn/media/a.mp3", "https://direct-api.cangyuansuanli.cn/media/b.mp3"}
	if !reflect.DeepEqual(gotURLs, wantURLs) {
		t.Fatalf("audio URLs = %#v, want %#v", gotURLs, wantURLs)
	}
	for _, audio := range completed.Result.Audios {
		if audio.Kind != "audio" || !audio.Ephemeral {
			t.Fatalf("audio reference = %#v", audio)
		}
	}
	failed, err := adapter.ParsePoll(context.Background(), PollContext{TaskID: created.TaskID}, []byte(`{"id":"task_42","status":"failed","error":{"code":"bad_prompt","message":"prompt rejected"}}`))
	if err != nil || failed.Status != StatusFailed || failed.Message != "prompt rejected" {
		t.Fatalf("failed poll = %#v, err = %v", failed, err)
	}
}

func TestCangyuanMusicPromptPackageMatchesSource(t *testing.T) {
	pluginRoot := filepath.Join("..", "..", "..", "plugin-packages")
	data, err := os.ReadFile(filepath.Join(pluginRoot, "cangyuan-music-prompt.yingce-plugin"))
	if err != nil {
		t.Fatal(err)
	}
	pkg, err := ParsePluginPackage(data)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"manifest.json", "README.md", "docs/interface.md"} {
		want, err := os.ReadFile(filepath.Join(pluginRoot, "cangyuan-music-prompt", filepath.FromSlash(name)))
		if err != nil {
			t.Fatal(err)
		}
		if got := pkg.Files[name]; !reflect.DeepEqual(got, want) {
			t.Fatalf("package file %s differs from source", name)
		}
	}
}
