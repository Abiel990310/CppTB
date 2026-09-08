import './styles/index.css';
import { CppRunner } from './components/code-runner.ts';
import { CppExercise } from './components/exercise.ts';
import { CppMemviz } from './components/memviz.ts';
import { CppQuiz } from './components/quiz.ts';
import { setupSearch } from './lib/search.ts';
import {
  setupProblemFilters,
  setupProgress,
  setupScrollSpy,
  setupSidebar,
  setupTheme,
} from './lib/site.ts';

customElements.define('cpp-runner', CppRunner);
customElements.define('cpp-exercise', CppExercise);
customElements.define('cpp-memviz', CppMemviz);
customElements.define('cpp-quiz', CppQuiz);

setupTheme();
setupSidebar();
setupScrollSpy();
setupProgress();
setupProblemFilters();
setupSearch();
