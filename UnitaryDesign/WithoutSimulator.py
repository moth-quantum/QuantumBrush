import pygame
import sys
import math
import random
from pygame.locals import *

# Initialize pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 1000, 700
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (200, 200, 200)
LIGHT_BLUE = (173, 216, 230)
BLUE = (0, 0, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
PURPLE = (128, 0, 128)
ORANGE = (255, 165, 0)

# Game states
MENU = 0
TUTORIAL = 1
SIMULATION = 2
QUIZ = 3

# Font
FONT = pygame.font.SysFont('Arial', 20)
LARGE_FONT = pygame.font.SysFont('Arial', 36)
MEDIUM_FONT = pygame.font.SysFont('Arial', 28)

class Button:
    def __init__(self, x, y, width, height, text, color=LIGHT_BLUE, hover_color=BLUE, text_color=BLACK):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.color = color
        self.hover_color = hover_color
        self.text_color = text_color
        self.current_color = color
        
    def draw(self, surface):
        pygame.draw.rect(surface, self.current_color, self.rect, border_radius=10)
        pygame.draw.rect(surface, BLACK, self.rect, 2, border_radius=10)
        
        text_surface = FONT.render(self.text, True, self.text_color)
        text_rect = text_surface.get_rect(center=self.rect.center)
        surface.blit(text_surface, text_rect)
        
    def check_hover(self, pos):
        if self.rect.collidepoint(pos):
            self.current_color = self.hover_color
            return True
        else:
            self.current_color = self.color
            return False
    
    def is_clicked(self, pos, event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            return self.rect.collidepoint(pos)
        return False

class GroverGame:
    def __init__(self):
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Grover's Algorithm Educational Game")
        self.clock = pygame.time.Clock()
        self.state = MENU
        
        # Tutorial state variables
        self.tutorial_page = 0
        self.max_tutorial_pages = 7
        
        # Simulation state variables
        self.database_size = 8
        self.marked_item = random.randint(0, self.database_size - 1)
        self.current_step = 0
        self.iterations = int(math.pi/4 * math.sqrt(self.database_size))
        self.amplitudes = [1/math.sqrt(self.database_size)] * self.database_size
        self.simulation_complete = False
        self.auto_run = False
        self.auto_run_speed = 1.0
        self.auto_run_timer = 0
        
        # Quiz state variables
        self.quiz_questions = [
            {
                "question": "What problem does Grover's algorithm solve?",
                "options": [
                    "Factoring large numbers",
                    "Unstructured search in a database",
                    "Finding the shortest path in a graph",
                    "Simulating quantum systems"
                ],
                "correct": 1
            },
            {
                "question": "What is the time complexity of Grover's algorithm?",
                "options": [
                    "O(N)",
                    "O(log N)",
                    "O(√N)",
                    "O(N²)"
                ],
                "correct": 2
            },
            {
                "question": "How many Grover iterations are needed for a database of size N?",
                "options": [
                    "N",
                    "log N",
                    "√N",
                    "π/4 * √N"
                ],
                "correct": 3
            },
            {
                "question": "What is the probability of measuring the marked item after Grover's algorithm completes?",
                "options": [
                    "50%",
                    "Close to 100%",
                    "1/N",
                    "It varies randomly"
                ],
                "correct": 1
            },
            {
                "question": "Which quantum gates are used in Grover's algorithm?",
                "options": [
                    "Only Hadamard gates",
                    "Hadamard and phase inversion gates",
                    "CNOT and T gates",
                    "Only SWAP gates"
                ],
                "correct": 1
            }
        ]
        self.current_question = 0
        self.score = 0
        self.question_answered = False
        self.selected_option = -1
        
        # Create buttons
        self.menu_buttons = [
            Button(WIDTH//2 - 150, 250, 300, 50, "Tutorial", LIGHT_BLUE),
            Button(WIDTH//2 - 150, 330, 300, 50, "Run Simulation", LIGHT_BLUE),
            Button(WIDTH//2 - 150, 410, 300, 50, "Take Quiz", LIGHT_BLUE),
            Button(WIDTH//2 - 150, 490, 300, 50, "Quit", LIGHT_BLUE)
        ]
        
        self.back_button = Button(50, HEIGHT - 70, 100, 40, "Back", GRAY)
        self.next_button = Button(WIDTH - 150, HEIGHT - 70, 100, 40, "Next", LIGHT_BLUE)
        
        # Simulation buttons
        self.simulation_buttons = [
            Button(50, HEIGHT - 150, 150, 40, "Step Forward", LIGHT_BLUE),
            Button(220, HEIGHT - 150, 150, 40, "Reset", LIGHT_BLUE),
            Button(390, HEIGHT - 150, 150, 40, "New Search", LIGHT_BLUE),
            Button(560, HEIGHT - 150, 150, 40, "Auto Run", LIGHT_BLUE),
            Button(730, HEIGHT - 150, 100, 40, "Faster", LIGHT_BLUE),
            Button(850, HEIGHT - 150, 100, 40, "Slower", LIGHT_BLUE)
        ]
        
        self.quiz_buttons = []
        for i in range(4):
            self.quiz_buttons.append(Button(WIDTH//2 - 200, 300 + 60*i, 400, 50, "", LIGHT_BLUE))
        self.next_question_button = Button(WIDTH//2 - 100, HEIGHT - 100, 200, 50, "Next Question", LIGHT_BLUE)
        
    def run(self):
        running = True
        while running:
            mouse_pos = pygame.mouse.get_pos()
            
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                
                # Handle different states
                if self.state == MENU:
                    self.handle_menu_events(event, mouse_pos)
                elif self.state == TUTORIAL:
                    self.handle_tutorial_events(event, mouse_pos)
                elif self.state == SIMULATION:
                    self.handle_simulation_events(event, mouse_pos)
                elif self.state == QUIZ:
                    self.handle_quiz_events(event, mouse_pos)
            
            # Draw the current state
            if self.state == MENU:
                self.draw_menu()
            elif self.state == TUTORIAL:
                self.draw_tutorial()
            elif self.state == SIMULATION:
                self.draw_simulation()
                # Handle auto-run
                if self.auto_run and not self.simulation_complete:
                    current_time = pygame.time.get_ticks()
                    if current_time - self.auto_run_timer > 1000 / self.auto_run_speed:
                        self.step_simulation()
                        self.auto_run_timer = current_time
            elif self.state == QUIZ:
                self.draw_quiz()
            
            pygame.display.flip()
            self.clock.tick(60)
        
        pygame.quit()
        sys.exit()
    
    def handle_menu_events(self, event, mouse_pos):
        for i, button in enumerate(self.menu_buttons):
            button.check_hover(mouse_pos)
            if button.is_clicked(mouse_pos, event):
                if i == 0:  # Tutorial
                    self.state = TUTORIAL
                    self.tutorial_page = 0
                elif i == 1:  # Simulation
                    self.state = SIMULATION
                    self.reset_simulation()
                elif i == 2:  # Quiz
                    self.state = QUIZ
                    self.reset_quiz()
                elif i == 3:  # Quit
                    pygame.quit()
                    sys.exit()
    
    def handle_tutorial_events(self, event, mouse_pos):
        self.back_button.check_hover(mouse_pos)
        if self.back_button.is_clicked(mouse_pos, event):
            if self.tutorial_page > 0:
                self.tutorial_page -= 1
            else:
                self.state = MENU
        
        self.next_button.check_hover(mouse_pos)
        if self.next_button.is_clicked(mouse_pos, event):
            if self.tutorial_page < self.max_tutorial_pages - 1:
                self.tutorial_page += 1
            else:
                self.state = MENU
    
    def handle_simulation_events(self, event, mouse_pos):
        self.back_button.check_hover(mouse_pos)
        if self.back_button.is_clicked(mouse_pos, event):
            self.state = MENU
            self.auto_run = False
        
        for i, button in enumerate(self.simulation_buttons):
            button.check_hover(mouse_pos)
            if button.is_clicked(mouse_pos, event):
                if i == 0:  # Step Forward
                    self.step_simulation()
                elif i == 1:  # Reset
                    self.reset_simulation(keep_marked=True)
                elif i == 2:  # New Search
                    self.reset_simulation(keep_marked=False)
                elif i == 3:  # Auto Run
                    self.auto_run = not self.auto_run
                    self.auto_run_timer = pygame.time.get_ticks()
                    if self.auto_run:
                        self.simulation_buttons[3].text = "Stop Auto"
                    else:
                        self.simulation_buttons[3].text = "Auto Run"
                elif i == 4:  # Faster
                    self.auto_run_speed = min(5.0, self.auto_run_speed * 1.5)
                elif i == 5:  # Slower
                    self.auto_run_speed = max(0.5, self.auto_run_speed / 1.5)
    
    def handle_quiz_events(self, event, mouse_pos):
        if not self.question_answered:
            for i, button in enumerate(self.quiz_buttons):
                button.check_hover(mouse_pos)
                if button.is_clicked(mouse_pos, event):
                    self.question_answered = True
                    self.selected_option = i
                    if i == self.quiz_questions[self.current_question]["correct"]:
                        self.score += 1
        else:
            self.next_question_button.check_hover(mouse_pos)
            if self.next_question_button.is_clicked(mouse_pos, event):
                self.current_question += 1
                if self.current_question >= len(self.quiz_questions):
                    # Quiz complete
                    self.state = MENU
                else:
                    self.question_answered = False
                    self.selected_option = -1
        
        self.back_button.check_hover(mouse_pos)
        if self.back_button.is_clicked(mouse_pos, event):
            self.state = MENU
    
    def draw_menu(self):
        self.screen.fill(WHITE)
        
        # Title
        title = LARGE_FONT.render("Grover's Algorithm Educational Game", True, BLACK)
        subtitle = MEDIUM_FONT.render("Learn about quantum search algorithms", True, BLACK)
        
        self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 80))
        self.screen.blit(subtitle, (WIDTH//2 - subtitle.get_width()//2, 150))
        
        # Draw buttons
        for button in self.menu_buttons:
            button.draw(self.screen)
    
    def draw_tutorial(self):
        self.screen.fill(WHITE)
        
        # Tutorial pages content
        tutorial_content = [
            {
                "title": "Introduction to Grover's Algorithm",
                "content": [
                    "Grover's algorithm is a quantum algorithm designed to search through",
                    "an unstructured database quadratically faster than classical algorithms.",
                    "",
                    "Invented by Lov Grover in 1996, it demonstrates quantum speedup for",
                    "search problems, providing a solution in O(√N) steps instead of O(N).",
                    "",
                    "While not as powerful as Shor's algorithm for factoring, it provides",
                    "a provable speedup for a wide range of practical search problems."
                ]
            },
            {
                "title": "The Search Problem",
                "content": [
                    "Consider searching for a specific item in an unsorted database:",
                    "",
                    "• Classical approach: Check items one-by-one until found (O(N) time)",
                    "• Quantum approach: Use amplitude amplification to increase the",
                    "  probability of measuring the correct answer (O(√N) time)",
                    "",
                    "This speedup becomes significant for very large databases!",
                    "",
                    "Example: For a database with 1,000,000 items:",
                    "• Classical search: up to 1,000,000 steps",
                    "• Grover's algorithm: about 1,000 steps"
                ]
            },
            {
                "title": "Quantum Mechanics Basics",
                "content": [
                    "Quantum computing is based on qubits instead of classical bits.",
                    "",
                    "• Classical bit: Can be either 0 or 1",
                    "• Qubit: Can be in a superposition of 0 and 1 simultaneously",
                    "",
                    "Quantum state can be represented as a vector of amplitudes,",
                    "where the square of each amplitude gives the probability of",
                    "measuring that particular state.",
                    "",
                    "Grover's algorithm leverages superposition and quantum interference",
                    "to amplify the amplitude of the target item."
                ]
            },
            {
                "title": "Grover's Algorithm Steps",
                "content": [
                    "The algorithm consists of these main steps:",
                    "",
                    "1. Initialize all qubits to equal superposition using Hadamard gates",
                    "2. Apply Grover iterations (approximately π/4·√N times):",
                    "   a. Oracle phase inversion: Mark the target item by inverting its phase",
                    "   b. Diffusion operator: Invert amplitudes around the average",
                    "3. Measure the final state",
                    "",
                    "Each iteration gradually increases the amplitude (and thus probability)",
                    "of measuring the marked item, while decreasing others."
                ]
            },
            {
                "title": "Oracle and Diffusion",
                "content": [
                    "Oracle Function:",
                    "• Identifies the marked item in the database",
                    "• Flips the phase (sign) of the marked item's amplitude",
                    "• Doesn't reveal which item is marked directly",
                    "",
                    "Diffusion Operator:",
                    "• Performs 'inversion about the mean'",
                    "• Amplitudes below average become above, and vice versa",
                    "• After oracle marks an item with negative phase, diffusion",
                    "  increases its magnitude while decreasing others",
                    "",
                    "Together, these operations amplify the target item's probability."
                ]
            },
            {
                "title": "Visualizing the Algorithm",
                "content": [
                    "Imagine the amplitudes as a histogram:",
                    "",
                    "1. Initial state: All bars equal height (equal superposition)",
                    "2. Oracle: Flips one bar to negative (phase inversion)",
                    "3. Diffusion: All bars 'reflect' around their average height",
                    "4. Result: Target bar gets taller, others get shorter",
                    "",
                    "With each iteration, the marked item's amplitude increases",
                    "until it reaches maximum probability after ~π/4·√N iterations.",
                    "",
                    "Too many iterations will cause the probability to decrease again!"
                ]
            },
            {
                "title": "Applications and Limitations",
                "content": [
                    "Applications:",
                    "• Database searching",
                    "• Element distinctness problem",
                    "• Collision finding",
                    "• Pattern matching",
                    "• Solving NP-complete problems with quantum speedup",
                    "",
                    "Limitations:",
                    "• Still requires O(√N) steps - not exponential speedup",
                    "• Requires a quantum oracle for the search problem",
                    "• Optimal number of iterations must be known in advance",
                    "• Need fault-tolerant quantum computers for practical use"
                ]
            }
        ]
        
        # Draw current tutorial page
        page = tutorial_content[self.tutorial_page]
        
        # Draw title
        title = LARGE_FONT.render(page["title"], True, BLACK)
        self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        # Draw content
        for i, line in enumerate(page["content"]):
            text = FONT.render(line, True, BLACK)
            self.screen.blit(text, (100, 120 + i*30))
        
        # Page indicator
        page_indicator = FONT.render(f"Page {self.tutorial_page + 1}/{self.max_tutorial_pages}", True, BLACK)
        self.screen.blit(page_indicator, (WIDTH//2 - page_indicator.get_width()//2, HEIGHT - 100))
        
        # Draw navigation buttons
        self.back_button.draw(self.screen)
        self.next_button.draw(self.screen)
    
    def draw_simulation(self):
        self.screen.fill(WHITE)
        
        # Title
        title = LARGE_FONT.render("Grover's Algorithm Simulation", True, BLACK)
        self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 20))
        
        # Draw database items
        self.draw_database()
        
        # Draw information
        info_text = [
            f"Database Size: {self.database_size}",
            f"Marked Item: {self.marked_item}",
            f"Current Step: {self.current_step}",
            f"Optimal Iterations: {self.iterations}",
            f"Auto Run Speed: {self.auto_run_speed:.1f}x"
        ]
        
        for i, text in enumerate(info_text):
            text_surface = FONT.render(text, True, BLACK)
            self.screen.blit(text_surface, (50, 80 + i*30))
        
        # Draw step explanation
        if self.current_step == 0:
            explanation = "Initial state: Equal superposition of all states."
        elif self.current_step % 2 == 1:
            explanation = "Oracle applied: Phase of marked item flipped (negative amplitude)."
        else:
            explanation = "Diffusion applied: Amplification around the mean."
        
        if self.simulation_complete:
            outcome = f"Final measurement: Item {self.get_most_probable_outcome()} (Correct: {self.get_most_probable_outcome() == self.marked_item})"
            expl_surface = FONT.render(explanation, True, BLACK)
            outcome_surface = MEDIUM_FONT.render(outcome, True, GREEN if self.get_most_probable_outcome() == self.marked_item else RED)
            self.screen.blit(expl_surface, (WIDTH//2 - expl_surface.get_width()//2, 80))
            self.screen.blit(outcome_surface, (WIDTH//2 - outcome_surface.get_width()//2, 110))
        else:
            expl_surface = FONT.render(explanation, True, BLACK)
            self.screen.blit(expl_surface, (WIDTH//2 - expl_surface.get_width()//2, 80))
        
        # Draw navigation buttons
        self.back_button.draw(self.screen)
        
        # Draw simulation buttons
        for button in self.simulation_buttons:
            button.draw(self.screen)
    
    def draw_database(self):
        # Calculate dimensions for visualization
        item_width = min(80, (WIDTH - 100) / self.database_size)
        max_height = 300
        base_y = HEIGHT - 250
        
        # Draw items
        for i in range(self.database_size):
            x = 50 + i * item_width
            
            # Get the probability and normalize height
            prob = self.amplitudes[i] ** 2
            height = prob * max_height
            
            # Determine color
            if i == self.marked_item:
                color = RED if self.amplitudes[i] < 0 else GREEN
            else:
                color = BLUE if self.amplitudes[i] < 0 else LIGHT_BLUE
            
            # Draw bar
            rect = pygame.Rect(x, base_y - height, item_width - 5, height)
            pygame.draw.rect(self.screen, color, rect)
            pygame.draw.rect(self.screen, BLACK, rect, 1)
            
            # Draw item number
            num_text = FONT.render(str(i), True, BLACK)
            self.screen.blit(num_text, (x + item_width/2 - num_text.get_width()/2, base_y + 10))
            
            # Draw probability percentage
            prob_text = FONT.render(f"{prob*100:.1f}%", True, BLACK)
            prob_width = prob_text.get_width()
            
            # Rotate text if it doesn't fit
            if prob_width > item_width - 5:
                prob_text = pygame.transform.rotate(prob_text, 90)
                self.screen.blit(prob_text, (x + item_width/2 - prob_text.get_height()/2, base_y - height - 30))
            else:
                self.screen.blit(prob_text, (x + item_width/2 - prob_width/2, base_y - height - 20))
    
    def draw_quiz(self):
        self.screen.fill(WHITE)
        
        # Title
        title = LARGE_FONT.render("Grover's Algorithm Quiz", True, BLACK)
        self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        # Score
        score_text = MEDIUM_FONT.render(f"Score: {self.score}/{len(self.quiz_questions)}", True, BLACK)
        self.screen.blit(score_text, (WIDTH - 200, 50))
        
        if self.current_question < len(self.quiz_questions):
            # Question
            question = self.quiz_questions[self.current_question]
            question_text = MEDIUM_FONT.render(f"Q{self.current_question + 1}: {question['question']}", True, BLACK)
            question_rect = question_text.get_rect(center=(WIDTH//2, 150))
            self.screen.blit(question_text, question_rect)
            
            # Options
            for i, option in enumerate(question["options"]):
                self.quiz_buttons[i].text = f"{chr(65+i)}. {option}"
                
                # Change button color if answered
                if self.question_answered:
                    if i == question["correct"]:
                        self.quiz_buttons[i].color = GREEN
                    elif i == self.selected_option and i != question["correct"]:
                        self.quiz_buttons[i].color = RED
                else:
                    self.quiz_buttons[i].color = LIGHT_BLUE
                
                self.quiz_buttons[i].draw(self.screen)
            
            # Next question button (only show if answered)
            if self.question_answered:
                self.next_question_button.draw(self.screen)
        else:
            # Quiz complete
            completion_text = LARGE_FONT.render("Quiz Complete!", True, BLACK)
            final_score = LARGE_FONT.render(f"Your Score: {self.score}/{len(self.quiz_questions)}", True, BLACK)
            
            self.screen.blit(completion_text, (WIDTH//2 - completion_text.get_width()//2, HEIGHT//2 - 50))
            self.screen.blit(final_score, (WIDTH//2 - final_score.get_width()//2, HEIGHT//2 + 20))
        
        # Back button
        self.back_button.draw(self.screen)
    
    def reset_simulation(self, keep_marked=True):
        # Reset amplitudes to equal superposition
        self.amplitudes = [1/math.sqrt(self.database_size)] * self.database_size
        self.current_step = 0
        
        # Reset or keep marked item
        if not keep_marked:
            self.marked_item = random.randint(0, self.database_size - 1)
        
        # Reset iterations based on database size
        self.iterations = int(math.pi/4 * math.sqrt(self.database_size))
        self.simulation_complete = False
    
    def step_simulation(self):
        if self.simulation_complete:
            return
        
        # Oracle operation (odd steps)
        if self.current_step % 2 == 0:
            # Flip the phase of the marked item
            self.amplitudes[self.marked_item] = -self.amplitudes[self.marked_item]
            self.current_step += 1
        # Diffusion operation (even steps)
        else:
            # Calculate the mean amplitude
            mean = sum(self.amplitudes) / self.database_size
            
            # Invert around the mean
            for i in range(self.database_size):
                self.amplitudes[i] = 2 * mean - self.amplitudes[i]
            
            self.current_step += 1
            
            # Check if we've completed the optimal number of iterations
            if self.current_step >= self.iterations * 2:
                self.simulation_complete = True
                # Stop auto-run if active
                if self.auto_run:
                    self.auto_run = False
                    self.simulation_buttons[3].text = "Auto Run"
    
    def get_most_probable_outcome(self):
        max_prob = 0
        max_idx = 0
        
        for i in range(self.database_size):
            prob = self.amplitudes[i] ** 2
            if prob > max_prob:
                max_prob = prob
                max_idx = i
        
        return max_idx
    
    def reset_quiz(self):
        self.current_question = 0
        self.score = 0
        self.question_answered = False
        self.selected_option = -1
        
        # Shuffle quiz questions for variety
        random.shuffle(self.quiz_questions)

# Run the game
if __name__ == "__main__":
    game = GroverGame()
    game.run()