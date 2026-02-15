import pygame
import sys
import math
import random
from pygame.locals import *
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator


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

class DeutschJozsaGame:
    def __init__(self):
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Deutsch-Jozsa Algorithm Educational Game")
        self.clock = pygame.time.Clock()
        self.state = MENU

        # Tutorial state variables
        self.tutorial_page = 0
        self.max_tutorial_pages = 6

        # Simulation state variables
        self.n_qubits = 3  # n input + 1 ancilla
        self.function_type = None
        self.oracle = None
        self.circuit_steps = [
            "Initialize qubits",
            "Apply Hadamard gates",
            "Apply Oracle",
            "Apply Final Hadamards",
            "Measure"
        ]
        self.current_step = 0
        self.measurement_result = None
        self.amplitudes = []
        self.probabilities = []
        self.revealed_function = False
        self.initialize_simulation()

        # Quiz questions
        self.quiz_questions = [
            {
                "question": "What problem does Deutsch-Jozsa solve?",
                "options": [
                    "Searching unsorted databases",
                    "Determining function consistency",
                    "Prime factorization",
                    "Graph traversal"
                ],
                "correct": 1
            },
            {
                "question": "What's the quantum complexity of Deutsch-Jozsa?",
                "options": [
                    "O(1)",
                    "O(n)",
                    "O(2^n)",
                    "O(log n)"
                ],
                "correct": 0
            },
            {
                "question": "How many classical queries are needed in worst case?",
                "options": [
                    "1",
                    "2^(n-1)+1",
                    "n",
                    "2^n"
                ],
                "correct": 1
            },
            {
                "question": "What's the ancilla qubit initialized to?",
                "options": [
                    "|0>",
                    "|1>",
                    "|+>",
                    "|->"
                ],
                "correct": 3
            },
            {
                "question": "What indicates a constant function?",
                "options": [
                    "All zeros measurement",
                    "Non-zero measurement",
                    "Alternating bits",
                    "All ones measurement"
                ],
                "correct": 0
            }
        ]

        # Menu buttons
        self.menu_buttons = [
            Button(WIDTH//2 - 150, 250, 300, 50, "Tutorial", LIGHT_BLUE),
            Button(WIDTH//2 - 150, 330, 300, 50, "Simulation", LIGHT_BLUE),
            Button(WIDTH//2 - 150, 410, 300, 50, "Quiz", LIGHT_BLUE),
            Button(WIDTH//2 - 150, 490, 300, 50, "Quit", LIGHT_BLUE)
        ]
        
        self.back_button = Button(50, HEIGHT - 70, 100, 40, "Back", GRAY)
        self.next_button = Button(WIDTH - 150, HEIGHT - 70, 100, 40, "Next", LIGHT_BLUE)
        
        # Simulation buttons
        self.simulation_buttons = [
            Button(50, HEIGHT - 150, 150, 40, "Step Forward", LIGHT_BLUE),
            Button(220, HEIGHT - 150, 150, 40, "New Function", LIGHT_BLUE),
            Button(390, HEIGHT - 150, 150, 40, "Reveal Function", LIGHT_BLUE)
        ]

        # Quiz buttons
        self.quiz_buttons = []
        for i in range(4):
            self.quiz_buttons.append(Button(WIDTH//2 - 200, 300 + 60*i, 400, 50, "", LIGHT_BLUE))
        self.next_question_button = Button(WIDTH//2 - 100, HEIGHT - 100, 200, 50, "Next Question", LIGHT_BLUE)

    def initialize_simulation(self):
        self.function_type = random.choice(['constant', 'balanced'])
        self.qc = QuantumCircuit(self.n_qubits, self.n_qubits-1)
        
        # Initialize ancilla qubit to |-> state
        self.qc.x(self.n_qubits-1)
        self.qc.h(self.n_qubits-1)
        
        # Create oracle
        self.create_oracle()
        
        self.current_step = 0
        self.measurement_result = None
        self.revealed_function = False
        self.update_amplitudes()

    def create_oracle(self):
        # Constant oracle
        if self.function_type == 'constant':
            if random.choice([True, False]):
                self.qc.z(self.n_qubits-1)
        # Balanced oracle
        else:
            for qubit in range(self.n_qubits-1):
                if random.random() > 0.5:
                    self.qc.cx(qubit, self.n_qubits-1)

    def update_amplitudes(self):
        statevector = Statevector(self.qc)
        self.amplitudes = [abs(amp) for amp in statevector.data]
        self.probabilities = [abs(amp)**2 for amp in statevector.data]

    def run(self):
        running = True
        while running:
            mouse_pos = pygame.mouse.get_pos()
            
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                
                if self.state == MENU:
                    self.handle_menu_events(event, mouse_pos)
                elif self.state == TUTORIAL:
                    self.handle_tutorial_events(event, mouse_pos)
                elif self.state == SIMULATION:
                    self.handle_simulation_events(event, mouse_pos)
                elif self.state == QUIZ:
                    self.handle_quiz_events(event, mouse_pos)
            
            self.draw_states()
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
                    self.initialize_simulation()
                elif i == 2:  # Quiz
                    self.state = QUIZ
                    self.reset_quiz()
                elif i == 3:  # Quit
                    pygame.quit()
                    sys.exit()

    def handle_simulation_events(self, event, mouse_pos):
       self.back_button.check_hover(mouse_pos)
       if self.back_button.is_clicked(mouse_pos, event):
           self.state = MENU
    
       for i, button in enumerate(self.simulation_buttons):
           button.check_hover(mouse_pos)
           if button.is_clicked(mouse_pos, event):
              if i == 0:  # Step Forward
                self.step_simulation()
              elif i == 1:  # New Function
                self.initialize_simulation()
              elif i == 2:  # Reveal Function
                self.revealed_function = True



    def step_simulation(self):
        if self.current_step >= len(self.circuit_steps):
            return

        if self.current_step == 1:
            self.qc.h(range(self.n_qubits))
        elif self.current_step == 3:
            self.qc.h(range(self.n_qubits-1))
        elif self.current_step == 4:
            # Use Statevector to get exact probabilities
            statevector = Statevector(self.qc)
            probabilities = statevector.probabilities()
            
            # Find the most probable outcome
            max_prob = max(probabilities)
            outcomes = [i for i, prob in enumerate(probabilities) if prob == max_prob]
            
            # Check if all outcomes are 0...0 (constant)
            all_zero = all(f"{outcome:0{self.n_qubits-1}b}" == '0'*(self.n_qubits-1) 
                         for outcome in outcomes)
            
            self.measurement_result = 'constant' if all_zero else 'balanced'

        self.current_step = min(self.current_step + 1, len(self.circuit_steps))
        self.update_amplitudes()

    def update_amplitudes(self):
        statevector = Statevector(self.qc)
        self.amplitudes = [abs(amp) for amp in statevector.data]
        self.probabilities = [abs(amp)**2 for amp in statevector.data]

    def draw_states(self):
        self.screen.fill(WHITE)
        
        if self.state == MENU:
            self.draw_menu()
        elif self.state == TUTORIAL:
            self.draw_tutorial()
        elif self.state == SIMULATION:
            self.draw_simulation()
        elif self.state == QUIZ:
            self.draw_quiz()

    def draw_simulation(self):
    # Title
       title = LARGE_FONT.render("Deutsch-Jozsa Algorithm Simulation", True, BLACK)
       self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 20))

    # Information panel
       info_y = 80
       func_text = [
           f"Function Type: {'Secret' if not self.revealed_function else self.function_type}",
           f"Measurement Result: {self.measurement_result if self.measurement_result else 'Not measured'}",
           f"Current Step: {self.circuit_steps[self.current_step] if self.current_step < len(self.circuit_steps) else 'Complete'}"
    ]
       for text in func_text:
          text_surface = FONT.render(text, True, BLACK)
          self.screen.blit(text_surface, (50, info_y))
          info_y += 30

    # Circuit visualization (moved down)
       self.draw_circuit(start_y=200)  # Increased from 150

    # Amplitude visualization (moved down)
       self.draw_amplitudes(base_y=HEIGHT - 200)  # Increased from 250

    # Buttons
       self.back_button.draw(self.screen)
       for button in self.simulation_buttons:
           button.draw(self.screen)

    def draw_circuit(self, start_y=200):  # Added parameter
      qubit_spacing = 40
      circuit_left = 50
    
    # Draw qubit lines
      for i in range(self.n_qubits):
          y = start_y + i * qubit_spacing
          pygame.draw.line(self.screen, BLACK, (circuit_left, y), (WIDTH-50, y), 2)
        
        # Qubit labels
          label = "Input" if i < self.n_qubits-1 else "Ancilla"
          text = FONT.render(f"Q{i} ({label})", True, BLACK)
          self.screen.blit(text, (circuit_left - 80, y - 10))

    # Draw gates with adjusted positions
      gate_positions = [150, 250, 350, 450]  # Adjusted spacing
      for step, pos in enumerate(gate_positions[:self.current_step]):
          for i in range(self.n_qubits):
              y = start_y + i * qubit_spacing
              if step == 0:  # Initial Hadamard
                 if i < self.n_qubits:
                     self.draw_gate(pos, y, "H")
              elif step == 1:  # Oracle
                   self.draw_gate(pos, y, "U_f")
              elif step == 2:  # Final Hadamard
                 if i < self.n_qubits-1:
                     self.draw_gate(pos, y, "H")
              elif step == 3:  # Measurement
                 if i < self.n_qubits-1:
                     self.draw_measurement(pos, y)

    def draw_amplitudes(self, base_y=500):  # Added parameter
      max_height = 150  # Reduced from 200
      num_states = 2**(self.n_qubits-1)
      state_width = (WIDTH - 100) / num_states
    
      for i in range(num_states):
          prob = self.probabilities[i]
          height = prob * max_height
          x = 50 + i * state_width
          color = GREEN if i == 0 and self.measurement_result == 'constant' else BLUE
        
          pygame.draw.rect(self.screen, color, (x, base_y - height, state_width - 5, height))
          pygame.draw.rect(self.screen, BLACK, (x, base_y - height, state_width - 5, height), 1)
        
        # State label
          state = format(i, f'0{self.n_qubits-1}b')
          text = FONT.render(state, True, BLACK)
          self.screen.blit(text, (x + state_width/2 - text.get_width()/2, base_y + 10))
    
    
    def draw_gate(self, x, y, symbol):
        gate_rect = pygame.Rect(x-15, y-15, 30, 30)
        pygame.draw.rect(self.screen, PURPLE, gate_rect, border_radius=5)
        pygame.draw.rect(self.screen, BLACK, gate_rect, 2, border_radius=5)
        text = FONT.render(symbol, True, WHITE)
        self.screen.blit(text, (x - text.get_width()/2, y - text.get_height()/2))

    def draw_measurement(self, x, y):
        # Draw measurement symbol
        pygame.draw.circle(self.screen, ORANGE, (x, y), 15, 2)
        pygame.draw.line(self.screen, ORANGE, (x-10, y+10), (x+10, y+10), 2)
        pygame.draw.line(self.screen, ORANGE, (x, y+10), (x, y+20), 2)

   
    def draw_tutorial(self):
        self.screen.fill(WHITE)
        tutorial_content = [
            {
                "title": "Deutsch-Jozsa Algorithm Introduction",
                "content": [
                    "The Deutsch-Jozsa algorithm is the first quantum algorithm",
                    "showing exponential speedup over classical computers.",
                    "",
                    "Problem: Determine if a function f is constant (same output",
                    "for all inputs) or balanced (outputs 0 for half inputs, 1 for other half).",
                    "",
                    "Classical Complexity: Up to 2^(n-1)+1 queries needed",
                    "Quantum Complexity: Only 1 query required"
                ]
            },
            {
                "title": "Classical vs Quantum Approach",
                "content": [
                    "Classical Worst-Case Scenario:",
                    "• For n-bit input function",
                    "• Might need to check over half of all possible inputs",
                    "• Exponential complexity O(2^(n-1))",
                    "",
                    "Quantum Solution:",
                    "• Uses quantum superposition and interference",
                    "• Determines answer with single function evaluation",
                    "• Constant time complexity O(1)",
                    "",
                    "Provides exponential speedup for this specific problem"
                ]
            },
            {
                "title": "Algorithm Steps",
                "content": [
                    "1. Initialize qubits:",
                    "   - Input qubits: |0⟩^⊗n",
                    "   - Ancilla qubit: |1⟩",
                    "2. Apply Hadamard gates to all qubits",
                    "3. Apply quantum oracle U_f",
                    "4. Apply Hadamard gates to input qubits",
                    "5. Measure input qubits",
                    "",
                    "Key Insight:",
                    "• If all measurements are 0 → Constant function",
                    "• Any other result → Balanced function"
                ]
            },
            {
                "title": "Quantum Oracle Explanation",
                "content": [
                    "The oracle U_f implements the function f as:",
                    "U_f|x⟩|y⟩ = |x⟩|y⊕f(x)⟩",
                    "",
                    "For constant functions:",
                    "• Either always flips ancilla qubit (f(x)=1)",
                    "• Or never flips ancilla qubit (f(x)=0)",
                    "",
                    "For balanced functions:",
                    "• Flips ancilla for exactly half of input states",
                    "",
                    "The algorithm cleverly uses phase kickback to",
                    "create interference patterns revealing function type"
                ]
            },
            {
                "title": "Circuit Components",
                "content": [
                    "Key Quantum Gates:",
                    "• Hadamard (H): Creates superpositions",
                    "• CNOT: Entangles qubits",
                    "• Z Gate: Phase flip",
                    "",
                    "Circuit Structure:",
                    "1. Initialization:",
                    "   - Ancilla qubit prepared in |1⟩ state",
                    "2. Parallel Evaluation:",
                    "   - Oracle evaluates all inputs simultaneously",
                    "3. Interference:",
                    "   - Hadamards create constructive/destructive interference",
                    "4. Measurement:",
                    "   - Collapses to final result revealing function type"
                ]
            },
            {
                "title": "Applications and Significance",
                "content": [
                    "Practical Applications:",
                    "• Foundation for many quantum algorithms",
                    "• Demonstrates quantum parallelism",
                    "• Template for oracle-based algorithms",
                    "",
                    "Theoretical Significance:",
                    "• First provable exponential speedup",
                    "• Demonstrates quantum advantage",
                    "• Inspired development of other algorithms",
                    "",
                    "Limitations:",
                    "• Solves artificial problem",
                    "• Requires perfect quantum coherence",
                    "• Needs error correction for large implementations"
                ]
            }
        ]

        page = tutorial_content[self.tutorial_page]
        
        # Draw title
        title = LARGE_FONT.render(page["title"], True, BLACK)
        self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        # Draw content
        y_offset = 150
        for line in page["content"]:
            text = FONT.render(line, True, BLACK)
            self.screen.blit(text, (100, y_offset))
            y_offset += 30

        # Page indicator
        page_text = FONT.render(f"Page {self.tutorial_page + 1}/{self.max_tutorial_pages}", True, BLACK)
        self.screen.blit(page_text, (WIDTH//2 - page_text.get_width()//2, HEIGHT - 100))
        
        # Navigation buttons
        self.back_button.draw(self.screen)
        self.next_button.draw(self.screen)

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
                    self.state = MENU
                else:
                    self.question_answered = False
                    self.selected_option = -1
        
        self.back_button.check_hover(mouse_pos)
        if self.back_button.is_clicked(mouse_pos, event):
            self.state = MENU

    def draw_quiz(self):
        self.screen.fill(WHITE)
        title = LARGE_FONT.render("Deutsch-Jozsa Quiz", True, BLACK)
        self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        # Score
        score_text = MEDIUM_FONT.render(f"Score: {self.score}/{len(self.quiz_questions)}", True, BLACK)
        self.screen.blit(score_text, (WIDTH - 200, 50))

        if self.current_question < len(self.quiz_questions):
            question = self.quiz_questions[self.current_question]
            q_text = MEDIUM_FONT.render(f"Q{self.current_question+1}: {question['question']}", True, BLACK)
            self.screen.blit(q_text, (100, 150))

            # Options
            for i, option in enumerate(question["options"]):
                self.quiz_buttons[i].text = f"{chr(65+i)}. {option}"
                if self.question_answered:
                    if i == question["correct"]:
                        self.quiz_buttons[i].color = GREEN
                    elif i == self.selected_option:
                        self.quiz_buttons[i].color = RED
                else:
                    self.quiz_buttons[i].color = LIGHT_BLUE
                self.quiz_buttons[i].draw(self.screen)

            if self.question_answered:
                explanation = self.get_quiz_explanation(self.current_question)
                expl_text = FONT.render(explanation, True, BLACK)
                self.screen.blit(expl_text, (100, HEIGHT - 150))
                self.next_question_button.draw(self.screen)
        else:
            completion_text = LARGE_FONT.render("Quiz Complete!", True, BLACK)
            score_text = LARGE_FONT.render(f"Final Score: {self.score}/{len(self.quiz_questions)}", True, BLACK)
            self.screen.blit(completion_text, (WIDTH//2 - completion_text.get_width()//2, HEIGHT//2 - 50))
            self.screen.blit(score_text, (WIDTH//2 - score_text.get_width()//2, HEIGHT//2 + 20))

        self.back_button.draw(self.screen)

    def get_quiz_explanation(self, question_idx):
        explanations = [
            "The Deutsch-Jozsa algorithm determines if a function is constant (same output for all inputs) or balanced (outputs 0 for half of inputs, 1 for the other half).",
            "The quantum solution requires only 1 function evaluation due to quantum parallelism and interference.",
            "Classical deterministic algorithms need 2^(n-1)+1 queries in worst case to be certain.",
            "The ancilla qubit is initialized to |1⟩ and put in |-> state with a Hadamard gate for phase kickback.",
            "All zero measurements indicate constructive interference from a constant function."
        ]
        return explanations[question_idx]

    def reset_quiz(self):
        self.current_question = 0
        self.score = 0
        self.question_answered = False
        self.selected_option = -1
        random.shuffle(self.quiz_questions)

    def draw_menu(self):
        self.screen.fill(WHITE)
        
        # Title
        title = LARGE_FONT.render("Deutsch-Jozsa Algorithm Educational Game", True, BLACK)
        subtitle = MEDIUM_FONT.render("Learn about quantum function evaluation", True, BLACK)
        
        self.screen.blit(title, (WIDTH//2 - title.get_width()//2, 80))
        self.screen.blit(subtitle, (WIDTH//2 - subtitle.get_width()//2, 150))
        
        # Draw menu buttons
        for button in self.menu_buttons:
            button.draw(self.screen)

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

    def draw_states(self):
        self.screen.fill(WHITE)
        
        if self.state == MENU:
            self.draw_menu()
        elif self.state == TUTORIAL:
            self.draw_tutorial()
        elif self.state == SIMULATION:
            self.draw_simulation()
        elif self.state == QUIZ:
            self.draw_quiz()
            
        pygame.display.flip()



if __name__ == "__main__":
    game = DeutschJozsaGame()
    game.run()


