import { StoryGenre } from "../../../../../types/business";

interface StoryGenreOption {
  value: StoryGenre;
  label: string;
}

const storyGenresJson: StoryGenreOption[] = [
  { value: "mystery", label: "Mystery" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "romance", label: "Romance" },
  { value: "adventure", label: "Adventure" },
  { value: "fantasy", label: "Fantasy" },
  { value: "horror", label: "Horror" },
  { value: "drama", label: "Drama" },
  { value: "comedy", label: "Comedy" },
  { value: "thriller", label: "Thriller" },
  { value: "historical", label: "Historical" },
];

const storyGenresList: StoryGenre[] = storyGenresJson.map((g) => g.value);

export { storyGenresJson, storyGenresList };
