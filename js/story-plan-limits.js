export const STORY_PLAN_MIN_PHOTO_COUNT = 2;
export const STORY_PLAN_MAX_PHOTO_COUNT = 12;
export const STORY_PLAN_MAX_SECTION_COUNT = 6;

export function storyPlanPhotoCountIsValid(count) {
  return Number.isInteger(count)
    && count >= STORY_PLAN_MIN_PHOTO_COUNT
    && count <= STORY_PLAN_MAX_PHOTO_COUNT;
}
