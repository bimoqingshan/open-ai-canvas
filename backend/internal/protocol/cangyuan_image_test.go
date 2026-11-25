package protocol

import (
	"context"
	"testing"
)

func TestCangyuanImageRoutesReferenceInputToEditEndpoint(t *testing.T) {
	adapter := officialPackageAdapter(t, "cangyuan-image.yingce-plugin", "cangyuan-image")

	generation, err := adapter.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
		Model:  "gpt-image-2-1k",
		Prompt: "一只猫",
	}})
	if err != nil {
		t.Fatal(err)
	}
	if generation.Path != "/v1/images/generations" {
		t.Fatalf("text-only path = %q, want generations", generation.Path)
	}

	editRequest := GenerationRequest{
		Model:  "gpt-image-2-1k",
		Prompt: "把背景换成海边",
		Images: []MediaReference{{URL: "https://cdn.example/source.png", Role: "edit_source", Order: 0}},
	}
	edit, err := adapter.BuildCreate(context.Background(), RequestContext{Request: editRequest})
	if err != nil {
		t.Fatal(err)
	}
	if edit.Path != "/v1/images/edits" {
		t.Fatalf("reference path = %q, want edits", edit.Path)
	}
	body := manifestTestBody(t, edit)
	images, ok := body["images"].([]any)
	if !ok || len(images) != 1 || images[0] != "https://cdn.example/source.png" {
		t.Fatalf("edit images = %#v", body["images"])
	}

	poll, err := adapter.BuildPoll(context.Background(), PollContext{Request: editRequest, TaskID: "task-edit-1"})
	if err != nil {
		t.Fatal(err)
	}
	if poll.Path != "/v1/images/edits/task-edit-1" {
		t.Fatalf("edit poll path = %q, want edits task path", poll.Path)
	}
}
