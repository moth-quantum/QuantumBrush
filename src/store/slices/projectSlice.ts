import type { StateCreator } from "zustand";
import type { ProjectMetadata } from "../../types/project";

export interface ProjectSlice {
  currentProject: ProjectMetadata | null;
  projects: ProjectMetadata[];
  currentImage: string | null; // base64 data URL
  setCurrentProject: (project: ProjectMetadata | null) => void;
  setProjects: (projects: ProjectMetadata[]) => void;
  setCurrentImage: (image: string | null) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
  currentProject: null,
  projects: [],
  currentImage: null,
  setCurrentProject: (project) => set({ currentProject: project }),
  setProjects: (projects) => set({ projects }),
  setCurrentImage: (image) => set({ currentImage: image }),
});
