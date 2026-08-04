const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../../backend/src/data/exercises.json');
const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
const existingIds = new Set(existing.map(e => e.id));
const existingNames = new Set(existing.map(e => e.name.toLowerCase()));

const newExercises = [
  // ── DUMBBELL ──────────────────────────────────────────────────────────────
  {
    id: 'ex_grip_curl', name: 'Grip Curl',
    primaryMuscle: 'biceps', secondaryMuscles: [],
    equipment: 'dumbbell', category: 'isolation', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Hold dumbbell with neutral or reverse grip, palm facing down or inward','Keep elbow pinned to side','Curl dumbbell up emphasising forearm and brachioradialis','Squeeze at top, lower with full control'],
    tips: ['Great for building forearm thickness','Lighter weight than supinated curls for most people','Can be done with EZ bar for wrist relief']
  },
  {
    id: 'ex_wrist_curl', name: 'Wrist Curl',
    primaryMuscle: 'biceps', secondaryMuscles: [],
    equipment: 'dumbbell', category: 'isolation', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Sit on bench, forearm resting on thigh palm-up','Hold dumbbell with fingers curled loosely','Curl wrist upward through full range of motion','Lower slowly back to start, letting fingers open slightly'],
    tips: ['Keep forearm flat on thigh throughout','Use light weight — wrist flexors fatigue quickly','Pair with reverse wrist curl for balanced forearm development']
  },
  {
    id: 'ex_dumbbell_side_bend', name: 'Dumbbell Side Bend',
    primaryMuscle: 'core', secondaryMuscles: [],
    equipment: 'dumbbell', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Stand with one dumbbell at side, feet shoulder-width','Slide the dumbbell down the outside of your thigh, bending laterally','Feel a stretch in the opposite oblique','Return to standing and repeat'],
    tips: ['Hold only one dumbbell — the resistance should be on the working side','Avoid leaning forward or backward','For equal work on both obliques, hold a dumbbell in each hand']
  },
  {
    id: 'ex_bow_extension', name: 'Bow Extension',
    primaryMuscle: 'back', secondaryMuscles: ['shoulders'],
    equipment: 'dumbbell', category: 'isolation', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Lie face down, arms extended overhead holding light dumbbells','Simultaneously lift arms and legs off the floor','Hold 1-2 seconds at peak contraction','Lower slowly and repeat'],
    tips: ['Keep movements slow and controlled','Light weight only — focuses on posterior chain tension','Great for lower back health and posture correction']
  },
  {
    id: 'ex_v_sit_cross_jab', name: 'V-Sit Cross Jab',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders'],
    equipment: 'dumbbell', category: 'isolation', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Sit with knees bent, feet off floor in V-sit position','Hold light dumbbells at chest level','Rotate torso and punch across body alternating left and right','Keep core braced and hips square throughout'],
    tips: ['The lighter the weight, the longer you can maintain form','Keep feet elevated to maximise core engagement','Control the rotation — do not just swing arms']
  },
  {
    id: 'ex_incline_row', name: 'Incline Row',
    primaryMuscle: 'back', secondaryMuscles: ['biceps', 'shoulders'],
    equipment: 'dumbbell', category: 'compound', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Set bench to 30-45 degree incline, lie chest down','Hold dumbbells hanging toward floor','Row both dumbbells up by driving elbows toward ceiling','Squeeze shoulder blades at top, lower with control'],
    tips: ['Chest stays on the bench throughout for chest support and strict form','Elbows should travel back, not flare wide','Great chest-supported row variation that removes lower back stress']
  },
  {
    id: 'ex_floor_t_raise', name: 'Floor T Raise',
    primaryMuscle: 'back', secondaryMuscles: ['shoulders'],
    equipment: 'dumbbell', category: 'isolation', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Lie face down, arms extended out to sides forming a T','Hold light dumbbells with thumbs pointing up','Raise both arms toward ceiling squeezing shoulder blades','Hold 1-2 seconds and lower with control'],
    tips: ['Use very light weight — this targets small stabiliser muscles','Thumbs pointing up protects the rotator cuff','Excellent for posture correction and shoulder health']
  },
  {
    id: 'ex_renegade_row', name: 'Renegade Row',
    primaryMuscle: 'back', secondaryMuscles: ['core', 'chest', 'triceps'],
    equipment: 'dumbbell', category: 'compound', movementType: 'pull', difficulty: 'intermediate',
    instructions: ['Start in push-up position gripping two dumbbells shoulder-width','Keep body in a rigid plank throughout','Row one dumbbell to hip, elbow driving toward ceiling','Lower and repeat on other side, alternating each rep'],
    tips: ['The wider the feet, the more stable the plank — narrow stance increases core demand','Resist rotating the hips — anti-rotation is the point','Hexagonal dumbbells are far more stable than round ones']
  },
  {
    id: 'ex_seesaw_row', name: 'Seesaw Row',
    primaryMuscle: 'back', secondaryMuscles: ['biceps'],
    equipment: 'dumbbell', category: 'compound', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Hinge forward 45 degrees, dumbbells hanging','As one arm rows up, the other arm lowers','Move in a seesaw / alternating pattern continuously','Keep back flat and hips square throughout'],
    tips: ['The alternating rhythm keeps constant tension on both lats','Think of the opposite arm as a counterweight','Great for building unilateral strength and coordination']
  },
  {
    id: 'ex_jump_squat', name: 'Jump Squat',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    equipment: 'dumbbell', category: 'compound', movementType: 'legs', difficulty: 'intermediate',
    instructions: ['Hold light dumbbells at sides, feet shoulder-width','Perform a squat to parallel','Explosively drive through heels and jump off floor','Land softly with knees bent, absorbing force into next squat'],
    tips: ['Use light dumbbells or bodyweight only — heavy loads increase injury risk','Land toe-heel to protect joints','Great for power development and cardio integration']
  },
  {
    id: 'ex_reverse_lunge', name: 'Reverse Lunge',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'dumbbell', category: 'compound', movementType: 'legs', difficulty: 'beginner',
    instructions: ['Stand holding dumbbells at sides, feet together','Step one foot back and lower rear knee toward floor','Front knee stays over ankle — do not push forward','Drive through front heel to return to standing'],
    tips: ['Easier on the knees than forward lunge for most people','Keep torso upright throughout','Great beginner lunge variation before progressing to walking lunges']
  },
  {
    id: 'ex_side_lunge', name: 'Side Lunge',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'dumbbell', category: 'compound', movementType: 'legs', difficulty: 'beginner',
    instructions: ['Stand with feet together, hold dumbbells at chest or sides','Step wide to one side, bend that knee and sit into the lunge','Keep the other leg straight, foot flat on floor','Push off bent leg to return to standing'],
    tips: ['Works the groin and inner thigh more than forward/reverse lunges','Keep the bent knee tracking over toes','Add a goblet hold for better counterbalance and depth']
  },
  {
    id: 'ex_dumbbell_swing', name: 'Dumbbell Swing',
    primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings', 'back', 'core'],
    equipment: 'dumbbell', category: 'compound', movementType: 'hinge', difficulty: 'beginner',
    instructions: ['Hold one dumbbell with both hands, stand feet shoulder-width','Hinge at hips, swinging dumbbell back between legs','Drive hips forward explosively, swinging dumbbell to chest height','Let momentum carry it — this is a hip drive, not an arm raise'],
    tips: ['Same mechanics as kettlebell swing — hip hinge dominant, not a squat','Keep lower back neutral throughout the hinge','Great power and conditioning movement when done for reps']
  },
  {
    id: 'ex_farmers_walk', name: "Farmer's Walk",
    primaryMuscle: 'core', secondaryMuscles: ['back', 'shoulders', 'quads'],
    equipment: 'dumbbell', category: 'compound', movementType: 'hinge', difficulty: 'beginner',
    instructions: ['Pick up heavy dumbbells at sides with firm grip','Stand tall — shoulders back, core braced','Walk forward with controlled steps for distance or time','Keep breathing, maintain posture throughout'],
    tips: ['Heavier is better — this is a loaded carry, challenge your grip','Maintain upright posture — resist leaning with the weight','One of the best grip, core, and trap builders available']
  },
  {
    id: 'ex_thruster', name: 'Thruster',
    primaryMuscle: 'shoulders', secondaryMuscles: ['quads', 'glutes', 'triceps', 'core'],
    equipment: 'dumbbell', category: 'compound', movementType: 'push', difficulty: 'intermediate',
    instructions: ['Hold dumbbells at shoulder height, feet shoulder-width','Squat to parallel, keeping chest and elbows up','Drive up explosively from the bottom of the squat','Use the momentum to press dumbbells overhead to full lockout'],
    tips: ['The squat-to-press should be one fluid movement, not two separate exercises','Moderate weight — this is a conditioning movement','Breathing: inhale on the way down, exhale as you press']
  },
  {
    id: 'ex_wood_chop', name: 'Wood Chop',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders', 'back'],
    equipment: 'dumbbell', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Hold one dumbbell with both hands, starting high to one side','Rotate torso and chop diagonally down to opposite hip','Pivot back foot as needed to complete the rotation','Return to start with control and repeat'],
    tips: ['Power comes from rotating the thorax, not swinging the arms','Keep arms slightly bent throughout — not locked out','Progress to cable or medicine ball for smoother resistance curve']
  },
  {
    id: 'ex_plank_t', name: 'Plank T',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders', 'back'],
    equipment: 'dumbbell', category: 'isolation', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Start in push-up position holding two dumbbells','Rotate into a side plank, raising the top arm toward the ceiling to form a T','Hold 1-2 seconds at the top','Return to push-up position and repeat on other side'],
    tips: ['The dumbbell acts as handle for stability on the floor','Keep hips high and body straight throughout the rotation','Beginners: do this without dumbbells until comfortable']
  },

  // ── KETTLEBELL ────────────────────────────────────────────────────────────
  {
    id: 'ex_kb_alternating_curl', name: 'Kettlebell Alternating Curl',
    primaryMuscle: 'biceps', secondaryMuscles: [],
    equipment: 'kettlebell', category: 'isolation', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Stand holding a kettlebell in each hand, arms extended','Curl one kettlebell to shoulder height while the other stays down','Lower and curl the opposite arm','Maintain upright posture throughout'],
    tips: ['The kettlebell handle creates a different centre of mass than dumbbells','Supinate the wrist at the top for peak bicep contraction','Strict form — no swinging']
  },
  {
    id: 'ex_kb_around_the_body', name: 'Around the Body Pass',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders'],
    equipment: 'kettlebell', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Stand feet shoulder-width, hold kettlebell in one hand in front of hips','Pass it behind your back to the other hand','Continue in a full circle around the body','After prescribed reps, reverse direction'],
    tips: ['Engage core to resist rotation — the passing motion challenges anti-rotation','Keep movement controlled — do not rush the circle','Work equal reps in each direction']
  },
  {
    id: 'ex_kb_straight_arm_sit', name: 'Straight Arm Sit',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders'],
    equipment: 'kettlebell', category: 'isolation', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Lie on back holding kettlebell extended overhead, arm locked','Engage core and sit up keeping arm vertical throughout','Lower back down under control, arm stays overhead','Repeat without letting the arm drift'],
    tips: ['This is a core + shoulder stability combo — keep the arm perfectly vertical','Foundation of the Turkish Get-Up — master this first','Light weight until the pattern is ingrained']
  },
  {
    id: 'ex_kb_side_swing', name: 'Kettlebell Side Swing',
    primaryMuscle: 'glutes', secondaryMuscles: ['core', 'shoulders'],
    equipment: 'kettlebell', category: 'compound', movementType: 'hinge', difficulty: 'intermediate',
    instructions: ['Stand feet wider than shoulder-width, kettlebell between feet','Hinge at hips and swing kettlebell up to one side using hip drive','Guide it diagonally across and up to shoulder height on one side','Control the descent back through the hips and repeat or alternate sides'],
    tips: ['Hip drive powers the swing, not the arms','Keep the core braced throughout to protect the lower back','Great rotational power developer for athletes']
  },
  {
    id: 'ex_kb_half_tgu', name: 'Half Turkish Get-Up',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders', 'glutes'],
    equipment: 'kettlebell', category: 'compound', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Start lying on back, press kettlebell to ceiling with one hand locked','Roll to elbow on the same side, then to hand','Bridge hips up high — this is the halfway point','Reverse the sequence to return to floor'],
    tips: ['Learn the get-up in two halves before combining them','Keep eyes on the bell throughout','This half alone is an excellent shoulder stability drill']
  },
  {
    id: 'ex_kb_bent_over_row', name: 'Kettlebell Bent Over Row',
    primaryMuscle: 'back', secondaryMuscles: ['biceps'],
    equipment: 'kettlebell', category: 'compound', movementType: 'pull', difficulty: 'beginner',
    instructions: ['Hinge forward 45 degrees, kettlebell hanging from one hand','Keep back flat and core braced','Pull kettlebell toward hip, elbow driving toward ceiling','Lower with control to full extension'],
    tips: ['The kettlebell handle angle feels different from dumbbell at the bottom','Neutral back position is essential — do not round','Great single-arm strength builder for the back']
  },
  {
    id: 'ex_kb_bob_weave', name: 'Bob and Weave',
    primaryMuscle: 'core', secondaryMuscles: ['glutes', 'quads'],
    equipment: 'kettlebell', category: 'compound', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Hold kettlebell at chest, feet wider than shoulder-width','Shift weight to one side, drop and duck under an imaginary bar','Rise up on the other side maintaining a low squat','Move fluidly side to side in a U-shaped path'],
    tips: ['A boxing-inspired movement that trains lateral hip mobility and core stability','Keep the back flat and avoid rounding during the duck','Great conditioning and agility warm-up drill']
  },
  {
    id: 'ex_kb_single_arm_swing', name: 'Kettlebell Single Arm Swing',
    primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings', 'back', 'core', 'shoulders'],
    equipment: 'kettlebell', category: 'compound', movementType: 'hinge', difficulty: 'intermediate',
    instructions: ['Stand feet shoulder-width, kettlebell between feet','Hinge and grip bell with one hand','Drive hips forward explosively, swinging bell to shoulder height','Control the descent back through hips, switch hands or repeat same side'],
    tips: ['The single-arm version challenges the core much more than two-handed','Square both hips equally — resist rotation','Perfect technique precedes increasing weight']
  },
  {
    id: 'ex_kb_lunge_press', name: 'Kettlebell Lunge Press',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'shoulders', 'core'],
    equipment: 'kettlebell', category: 'compound', movementType: 'legs', difficulty: 'intermediate',
    instructions: ['Hold kettlebell in rack position at one shoulder','Step forward into a lunge, lowering back knee toward floor','At the bottom of the lunge, press the kettlebell overhead','Lower it back to rack as you drive back to standing'],
    tips: ['Ensures shoulder pressing against an unstable base — demands core stability','The timing: press at the bottom of the lunge, lower on the way up','Use opposite arm to lunge leg for the natural twisting engagement']
  },
  {
    id: 'ex_kb_thruster', name: 'Kettlebell Thruster',
    primaryMuscle: 'shoulders', secondaryMuscles: ['quads', 'glutes', 'triceps', 'core'],
    equipment: 'kettlebell', category: 'compound', movementType: 'push', difficulty: 'intermediate',
    instructions: ['Hold two kettlebells in rack position at shoulders','Squat to parallel, elbows tucked and chest up','Drive explosively from the squat and press both bells overhead','Lock out at top, then lower to rack for the next rep'],
    tips: ['Fluid squat-to-press is the goal — one continuous power movement','The squat generates momentum for the press — use it','One of the most effective conditioning exercises available']
  },
  {
    id: 'ex_kb_chest_press', name: 'Kettlebell Floor Press',
    primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'],
    equipment: 'kettlebell', category: 'compound', movementType: 'push', difficulty: 'beginner',
    instructions: ['Lie on floor holding two kettlebells above chest, handles vertical','Lower elbows to floor under control','Press bells back to starting position','Elbows at roughly 45 degrees to body'],
    tips: ['Floor limits range of motion — great for those with shoulder issues','The kettlebell handle rotation adds a unique wrist challenge vs dumbbells','Excellent pressing variation for home training']
  },
  {
    id: 'ex_kb_side_bend', name: 'Kettlebell Side Bend',
    primaryMuscle: 'core', secondaryMuscles: [],
    equipment: 'kettlebell', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Stand holding kettlebell in one hand at side','Slide the bell down the outside of your thigh, bending laterally','Feel stretch in opposite oblique','Return to upright and repeat'],
    tips: ['Kettlebell is heavier than dumbbells — use appropriate weight','Hold only one bell, on the working side','Resist the urge to lean forward during the bend']
  },

  // ── BODYWEIGHT ────────────────────────────────────────────────────────────
  {
    id: 'ex_push_back', name: 'Push-Back',
    primaryMuscle: 'chest', secondaryMuscles: ['shoulders', 'triceps', 'core'],
    equipment: 'bodyweight', category: 'compound', movementType: 'push', difficulty: 'beginner',
    instructions: ['Start in push-up position, hands slightly wider than shoulders','Lower into a push-up, stopping just above the floor','Push up and simultaneously rock back toward your heels','Extend arms and let hips rise, feeling a back/lat stretch'],
    tips: ['A hybrid between push-up and childs pose stretch','Good for mobility warm-up or active recovery','Keep core engaged throughout the rocking movement']
  },
  {
    id: 'ex_side_to_side_pushup', name: 'Side-to-Side Push-Up',
    primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders', 'core'],
    equipment: 'bodyweight', category: 'compound', movementType: 'push', difficulty: 'intermediate',
    instructions: ['Start in push-up position','Shift bodyweight to the right, bend that elbow and lower toward the right hand','Push back up to centre, then shift and lower to the left','Keep hips level and core tight throughout'],
    tips: ['Progressively loads one side at a time — good archer push-up progression','Wider hand placement makes it more lateral','Great precursor to single-arm push-up training']
  },
  {
    id: 'ex_crunch', name: 'Crunch',
    primaryMuscle: 'core', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Lie on back, knees bent, feet flat, hands behind head lightly','Curl shoulders off floor by contracting abs — not pulling the neck','Hold the peak contraction 1 second','Lower with control, do not rest head between reps'],
    tips: ['It is a short range movement — not a full sit-up','Exhale at the top to improve abdominal contraction','Hands behind head — do not pull — just support the weight']
  },
  {
    id: 'ex_scissor_kick', name: 'Scissor Kick',
    primaryMuscle: 'core', secondaryMuscles: ['quads'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Lie on back, hands under lower back for support, legs raised 6 inches','Alternate kicking legs up and down in a scissors motion','Keep lower back pressed to floor throughout','Breathe steadily — do not hold breath'],
    tips: ['The closer to the floor the legs are, the harder the exercise','Pressing lower back down is critical to protect the spine','Excellent hip flexor and lower ab burnout']
  },
  {
    id: 'ex_cross_body_crunch', name: 'Cross-Body Crunch',
    primaryMuscle: 'core', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Lie on back, hands lightly behind head, knees bent','Bring one knee toward chest as you rotate the opposite elbow toward it','Return to start and repeat on the other side','Move in a controlled bicycle-like pattern'],
    tips: ['The rotation is what activates the obliques — do not just lift straight up','Slower is harder — control both directions','Extend the working leg as the other knee comes in for extra intensity']
  },
  {
    id: 'ex_reverse_crunch', name: 'Reverse Crunch',
    primaryMuscle: 'core', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Lie on back, hands at sides, hips and knees at 90 degrees','Contract abs and curl hips up off floor toward chest','Do not swing — use controlled ab contraction','Lower slowly to start position'],
    tips: ['Targets the lower portion of the abs more than standard crunch','The smaller the range of motion, the more control you have','Progress by extending legs further out before curling in']
  },
  {
    id: 'ex_windshield_wiper', name: 'Windshield Wiper',
    primaryMuscle: 'core', secondaryMuscles: ['back'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Lie on back, arms out to sides for support, legs raised to 90 degrees','Rotate both legs together toward the floor on one side','Control the descent — do not let legs slam down','Reverse and rotate to the other side'],
    tips: ['The wider the arms, the more stable you are','Legs must stay at 90 degrees throughout','Advanced version: straight legs or add weight between feet']
  },
  {
    id: 'ex_lying_leg_lift', name: 'Lying Leg Lift',
    primaryMuscle: 'core', secondaryMuscles: ['quads'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Lie flat on back, hands under lower back for support','Raise both legs together to 90 degrees keeping them straight','Lower slowly to just above the floor — do not touch down','Repeat while keeping lower back pressed to floor'],
    tips: ['Pressing the lower back down throughout is essential for spine safety','The closer to the floor you lower, the harder the contraction','Bend knees slightly if you feel lower back strain']
  },
  {
    id: 'ex_leg_pull_in', name: 'Leg Pull-In',
    primaryMuscle: 'core', secondaryMuscles: ['quads'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Sit on edge of bench or floor, hands gripping sides for support','Extend legs out in front slightly above floor','Pull knees toward chest, drawing them in tight','Extend back out without touching the floor'],
    tips: ['Great lower ab and hip flexor exercise','Lean back slightly for extra core engagement','Slow the extension phase for more time under tension']
  },
  {
    id: 'ex_hanging_knee_raise', name: 'Hanging Knee Raise',
    primaryMuscle: 'core', secondaryMuscles: ['back'],
    equipment: 'pull-up-bar', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Hang from pull-up bar with overhand grip, arms fully extended','Brace core and pull knees up toward chest by contracting abs','Hold briefly at the top','Lower legs slowly — do not just drop them'],
    tips: ['Avoid swinging — momentum reduces the core work','Progress to straight-leg raises once this is easy','Grip endurance is often the limiting factor — use straps if needed']
  },
  {
    id: 'ex_superman', name: 'Superman',
    primaryMuscle: 'back', secondaryMuscles: ['glutes'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'hinge', difficulty: 'beginner',
    instructions: ['Lie face down, arms extended overhead','Simultaneously lift arms, chest, and legs off the floor','Hold peak position 2-3 seconds, squeezing glutes and back muscles','Lower slowly and repeat'],
    tips: ['Great for lower back strength and posture without loading the spine','Look down at the floor to keep neck neutral','Progress to single-arm/single-leg variations for asymmetric challenge']
  },
  {
    id: 'ex_dolphin_kick', name: 'Dolphin Kick',
    primaryMuscle: 'core', secondaryMuscles: ['back', 'glutes'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Start in forearm plank position','Engage core and pike hips up toward ceiling in a fluid arc','Lower hips through plank and continue to a slight dip below neutral','Return to plank — this creates a wave-like dolphin motion'],
    tips: ['The flowing motion demands continuous core and shoulder engagement','Keep arms fixed — only the hips and spine move','Great full-body core stability and shoulder strength drill']
  },
  {
    id: 'ex_bird_dog', name: 'Bird Dog',
    primaryMuscle: 'core', secondaryMuscles: ['back', 'glutes'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'core', difficulty: 'beginner',
    instructions: ['Start on all fours, hands under shoulders, knees under hips','Simultaneously extend opposite arm and leg until both parallel to floor','Hold 2-3 seconds, maintaining a flat back','Return and switch sides — that is one rep'],
    tips: ['The challenge is keeping the hips level — do not let them rotate or drop','Move slowly — this is a stability exercise, not a speed drill','An excellent low-back rehabilitation and prevention exercise']
  },
  {
    id: 'ex_side_to_side_pullup', name: 'Side-to-Side Pull-Up',
    primaryMuscle: 'back', secondaryMuscles: ['biceps', 'core'],
    equipment: 'pull-up-bar', category: 'compound', movementType: 'pull', difficulty: 'advanced',
    instructions: ['Hang from pull-up bar, hands wider than shoulder-width','Pull up and shift to one side so the bar meets that shoulder','Lower and pull up shifting to the opposite shoulder','Continue alternating sides in a smooth arcing motion'],
    tips: ['One step toward the archer pull-up — loads each side unequally','Requires considerable lat and bicep strength','Slow down the transitions — do not swing to get from side to side']
  },
  {
    id: 'ex_swimmer', name: 'Swimmer',
    primaryMuscle: 'back', secondaryMuscles: ['glutes', 'shoulders'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'hinge', difficulty: 'beginner',
    instructions: ['Lie face down, arms extended overhead, legs straight','Lift opposite arm and leg simultaneously like a swimming flutter kick','Alternate continuously in a fast or slow swimming motion','Keep core engaged and neck neutral throughout'],
    tips: ['Faster tempo = more cardio benefit; slower = more stability demand','Like Superman but with alternating movement — easier on the back','Great posterior chain warm-up or activation drill']
  },
  {
    id: 'ex_bodyweight_squat', name: 'Bodyweight Squat',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    equipment: 'bodyweight', category: 'compound', movementType: 'legs', difficulty: 'beginner',
    instructions: ['Stand feet shoulder-width, toes slightly out, arms forward for balance','Break at hips and knees simultaneously','Descend until thighs are parallel to floor or below','Drive through full foot to stand — do not shift forward onto toes'],
    tips: ['The foundation of all lower body training — master this before loading','Knees track over toes throughout','Add a pause at the bottom to build control and muscle activation']
  },
  {
    id: 'ex_bodyweight_fire_hydrant', name: 'Fire Hydrant',
    primaryMuscle: 'glutes', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'isolation', movementType: 'legs', difficulty: 'beginner',
    instructions: ['Start on all fours, hands under shoulders, knees under hips','Keeping knee bent at 90 degrees, raise one leg out to side','Lift until thigh is parallel to floor — like a dog at a fire hydrant','Lower with control and repeat before switching sides'],
    tips: ['Keep hips square — do not let them tilt or rotate','Slower movement increases glute activation','Progress by adding an ankle weight or hip circle band']
  },
  {
    id: 'ex_wall_sit', name: 'Wall Sit',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'bodyweight', category: 'isolation', movementType: 'legs', difficulty: 'beginner',
    isHold: true, holdSeconds: 30,
    instructions: ['Stand with back flat against a wall, feet shoulder-width','Walk feet out and slide down until knees are at 90 degrees','Thighs parallel to floor, shins vertical, back flat against wall','Hold the position, breathe steadily'],
    tips: ['Do not let knees push forward past toes','Flat back against the wall is essential — no rounding','Progress by increasing hold time or adding weight on thighs']
  },
  {
    id: 'ex_skater_squat', name: 'Skater Squat',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    equipment: 'bodyweight', category: 'compound', movementType: 'legs', difficulty: 'intermediate',
    instructions: ['Stand on one leg, opposite leg bent behind','Hinge at hip and bend standing knee to lower into a single-leg squat','Extend the free leg behind you for counterbalance as you descend','Drive through the standing foot to return upright'],
    tips: ['Easier than a full pistol squat — good stepping stone to it','The extended rear leg acts as a counterbalance — use it','Touch the rear knee softly to floor if you need a target for depth']
  },
  {
    id: 'ex_single_leg_squat', name: 'Single Leg Squat (Pistol)',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'core'],
    equipment: 'bodyweight', category: 'compound', movementType: 'legs', difficulty: 'advanced',
    instructions: ['Stand on one leg, extend other leg forward off floor','Lower by bending the standing knee, keeping extended leg straight','Descend as deep as hip mobility allows — ideally to full depth','Drive through the heel of the standing foot to return to standing'],
    tips: ['One of the most demanding bodyweight leg exercises','Requires excellent ankle, knee and hip mobility to perform safely','Use a counterbalance (light dumbbells in front) while learning the movement']
  },
  {
    id: 'ex_bodyweight_calf_raise', name: 'Bodyweight Calf Raise',
    primaryMuscle: 'quads', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'isolation', movementType: 'legs', difficulty: 'beginner',
    instructions: ['Stand with feet hip-width at edge of step or flat on floor','Rise on balls of feet as high as possible','Pause at top and squeeze calves hard','Lower heels below step level for full stretch if on a step'],
    tips: ['Full range of motion — all the way up and all the way down','Progress with a step for greater range and single-leg variation','Calves respond well to high rep sets — 15-30 reps per set']
  },
  {
    id: 'ex_jumping_jacks', name: 'Jumping Jacks',
    primaryMuscle: 'cardio', secondaryMuscles: ['shoulders', 'quads'],
    equipment: 'bodyweight', category: 'cardio', movementType: 'cardio', difficulty: 'beginner',
    instructions: ['Stand with feet together, arms at sides','Jump feet out wide while simultaneously raising arms overhead','Jump feet back together while lowering arms','Maintain a steady rhythm throughout'],
    tips: ['Classic full-body warm-up movement — great for elevating heart rate fast','Land softly to protect joints','Increase speed or add a weighted vest for more challenge']
  },
  {
    id: 'ex_bear_crawl', name: 'Bear Crawl',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders', 'quads', 'chest'],
    equipment: 'bodyweight', category: 'compound', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Start on all fours, knees hovering just 1 inch off the floor','Move opposite hand and foot forward simultaneously','Keep back flat and hips level — do not rise or sag','Crawl forward for distance, then backward to start'],
    tips: ['The hovering knees are what makes this different from normal crawling','Slow is harder — fight the urge to rush','Great full-body conditioning and shoulder stability drill']
  },
  {
    id: 'ex_crab_walk', name: 'Crab Walk',
    primaryMuscle: 'core', secondaryMuscles: ['triceps', 'glutes', 'shoulders'],
    equipment: 'bodyweight', category: 'compound', movementType: 'core', difficulty: 'beginner',
    instructions: ['Sit on floor, hands behind you, feet flat in front','Press hips up off floor into a tabletop position','Move one hand and the opposite foot together to travel sideways or forward','Keep hips elevated throughout'],
    tips: ['The height of the hips determines the tricep and glute demand','Walk forward, backward and laterally for variety','Great shoulder and posterior chain activation in an unusual position']
  },
  {
    id: 'ex_crocodile_crawl', name: 'Crocodile Crawl',
    primaryMuscle: 'core', secondaryMuscles: ['chest', 'shoulders', 'quads'],
    equipment: 'bodyweight', category: 'compound', movementType: 'core', difficulty: 'intermediate',
    instructions: ['Start in a low push-up position, very close to the floor','Move opposite elbow and knee forward simultaneously','Stay very low to the ground — less than 6 inches clearance','Crawl forward for distance keeping body flat and controlled'],
    tips: ['More challenging than bear crawl — much lower centre of gravity','Requires hip flexor mobility and tricep/shoulder endurance','Great for military-style conditioning and tactical fitness']
  },
  {
    id: 'ex_army_crawl', name: 'Army Crawl',
    primaryMuscle: 'core', secondaryMuscles: ['shoulders', 'back', 'quads'],
    equipment: 'bodyweight', category: 'compound', movementType: 'core', difficulty: 'beginner',
    instructions: ['Lie flat on stomach, arms bent in front','Pull forward using forearms and elbows while pushing with toes','Keep hips flat on the floor — no raising','Move forward alternating sides for distance'],
    tips: ['Flat hips to the floor is the main technical point','A genuine military and obstacle race training staple','Progress by pulling over rough surfaces or with a weighted vest']
  },
  {
    id: 'ex_pushup_with_reach', name: 'Push-Up with Reach',
    primaryMuscle: 'chest', secondaryMuscles: ['core', 'shoulders', 'triceps'],
    equipment: 'bodyweight', category: 'compound', movementType: 'push', difficulty: 'intermediate',
    instructions: ['Perform a standard push-up','At the top of the push-up, lift one arm and extend it straight ahead','Hold for 1-2 seconds, lower arm back down','Perform next push-up and reach with the other arm'],
    tips: ['The reach forces major anti-rotation core engagement','Wider foot stance increases stability for beginners','Can also rotate the arm to the side into a T position instead of forward']
  },

  // ── STRETCHING / MOBILITY ─────────────────────────────────────────────────
  {
    id: 'ex_neck_side_stretch', name: 'Neck Side Stretch',
    primaryMuscle: 'shoulders', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Sit or stand tall with good posture','Tilt head slowly to one side, bringing ear toward shoulder','Use opposite hand gently pressing top of head for a deeper stretch','Hold 20-30 seconds each side, breathe deeply'],
    tips: ['Never force the neck — gentle pressure only','Rotate the chin slightly up or down to hit different fibres of the neck','Great to do between sets during shoulder or upper back work']
  },
  {
    id: 'ex_upper_trap_stretch', name: 'Upper Trap Stretch',
    primaryMuscle: 'shoulders', secondaryMuscles: ['back'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Sit or stand, reach one hand behind your back','Tilt head to opposite side, looking slightly down at a 45-degree angle','Use free hand to gently apply downward pressure on the crown of the head','Hold 20-30 seconds each side'],
    tips: ['The 45-degree angle targets the upper trap specifically','The arm behind back depresses the shoulder for more stretch','A daily stretch — upper traps are chronically tight in desk workers']
  },
  {
    id: 'ex_levator_stretch', name: 'Levator Scapulae Stretch',
    primaryMuscle: 'back', secondaryMuscles: ['shoulders'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Sit tall, tuck chin slightly, rotate head 45 degrees to one side','Tilt head downward, bringing nose toward armpit','Use same-side hand on the back of the head to gently deepen the stretch','Hold 20-30 seconds each side'],
    tips: ['This targets the levator scapulae — a key source of neck and shoulder pain','Combined with upper trap stretch covers most of the neck musculature','Do not force the head — this should feel like a gentle pull, not pain']
  },
  {
    id: 'ex_shoulder_cross_body_stretch', name: 'Cross-Body Shoulder Stretch',
    primaryMuscle: 'shoulders', secondaryMuscles: ['back'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand or sit tall, extend one arm across chest at shoulder height','Use opposite hand or forearm to pull the extended arm toward the chest','Keep shoulder of the stretching arm down and back','Hold 20-30 seconds each side'],
    tips: ['Targets posterior deltoid and rotator cuff — commonly tight in pressing athletes','Avoid shrugging the shoulder being stretched','Excellent pre- and post-shoulder workout stretch']
  },
  {
    id: 'ex_triceps_overhead_stretch', name: 'Triceps Overhead Stretch',
    primaryMuscle: 'triceps', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Raise one arm overhead, bend elbow so hand drops behind head','Use opposite hand to gently press the elbow toward the midline and downward','Feel stretch on the back of the upper arm','Hold 20-30 seconds each side'],
    tips: ['Keep torso upright — do not let the body lean to stretch further','Great post-pressing stretch for triceps recovery','Also stretches the long head of the tricep into the shoulder area']
  },
  {
    id: 'ex_wrist_flexor_stretch', name: 'Wrist Flexor Stretch',
    primaryMuscle: 'biceps', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Extend one arm forward with palm facing up','Use opposite hand to gently press fingers back toward you','Hold 20-30 seconds feeling stretch in the forearm and wrist','Switch sides and repeat'],
    tips: ['Essential after heavy barbell or dumbbell work','Progress by pressing further back as flexibility improves','Pair with wrist extensor stretch for balanced forearm health']
  },
  {
    id: 'ex_chest_opener_stretch', name: 'Chest Opener Stretch',
    primaryMuscle: 'chest', secondaryMuscles: ['shoulders'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand or sit, interlace fingers behind back or extend arms behind','Squeeze shoulder blades together and lift chest upward','Open the chest by drawing elbows toward each other behind you','Hold 20-30 seconds, breathe deeply into the chest'],
    tips: ['Counteracts the forward shoulder posture caused by pressing and desk work','Can also be done in a doorway for greater stretch','Do this after any chest or anterior shoulder workout']
  },
  {
    id: 'ex_seated_back_stretch', name: 'Seated Back Stretch',
    primaryMuscle: 'back', secondaryMuscles: ['core'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Sit on floor with legs extended or in a chair','Hinge forward from hips, reaching arms toward feet','Round the upper back slightly to open up the thoracic spine','Hold 30-45 seconds, breathe into the stretch'],
    tips: ['Think about separating each vertebra as you fold forward','If hamstrings are tight, bend knees slightly','Great post-row and deadlift spinal decompression stretch']
  },
  {
    id: 'ex_childs_pose', name: "Child's Pose",
    primaryMuscle: 'back', secondaryMuscles: ['shoulders', 'glutes'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Kneel on floor, sit back onto heels','Extend arms forward along the mat, forehead to floor','Relax the back, let hips sink toward heels','Hold 30-60 seconds, breathing into the lower back'],
    tips: ['Widen knees for deeper hip stretch variation','Walk hands to one side to stretch the lat on that side','One of the best total back decompression stretches']
  },
  {
    id: 'ex_cat_cow', name: 'Cat-Cow',
    primaryMuscle: 'back', secondaryMuscles: ['core'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Start on all fours, hands under shoulders, knees under hips','Arch back toward the floor, head up — this is Cow position','Round back toward the ceiling, head drops — this is Cat','Flow smoothly between the two, matching movement to breath'],
    tips: ['Breathe in on Cow, breathe out on Cat for maximum benefit','This is the fundamental spinal mobility exercise','Move through your pain-free range — never force end range positions']
  },
  {
    id: 'ex_seated_butterfly', name: 'Seated Butterfly',
    primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Sit on floor, bring soles of feet together in front of you','Hold feet with hands, let knees fall open like butterfly wings','Sit tall and hinge forward from hips to deepen the groin stretch','Hold 30-60 seconds'],
    tips: ['Place hands on inner knees and press gently for a deeper adductor stretch','The closer feet are to groin, the more intense the stretch','Avoid rounding the lower back — hinge from the hips']
  },
  {
    id: 'ex_knee_to_chest_stretch', name: 'Knee-to-Chest Stretch',
    primaryMuscle: 'glutes', secondaryMuscles: ['back'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Lie on back with knees bent, feet flat','Pull one knee toward chest with both hands','Keep other leg flat on floor or bent','Hold 20-30 seconds each side'],
    tips: ['Great for lower back relief and glute stretch combined','Gently rock side to side for a lower back massage effect','Do both legs simultaneously for a deeper back stretch']
  },
  {
    id: 'ex_supine_spinal_twist', name: 'Supine Spinal Twist',
    primaryMuscle: 'back', secondaryMuscles: ['glutes', 'core'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Lie on back, extend arms out to sides like a T','Bring one knee across body toward the floor on the opposite side','Look in the opposite direction to the knee for full spinal rotation','Hold 30-45 seconds each side'],
    tips: ['Let gravity do the work — do not force the knee to the floor','Both shoulder blades stay in contact with the floor','Excellent lower back decompression stretch — great after any workout']
  },
  {
    id: 'ex_hip_flexor_stretch', name: 'Hip Flexor Lunge Stretch',
    primaryMuscle: 'quads', secondaryMuscles: ['glutes'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Step one foot forward into a lunge, lower back knee to floor','Keep front shin vertical, torso upright','Drive hips forward until you feel stretch in front of back hip and thigh','Hold 30-45 seconds each side, breathe into the stretch'],
    tips: ['Raise arms overhead to increase the hip flexor stretch','A posterior pelvic tilt (tuck the pelvis under) intensifies the stretch','One of the most important stretches for lifters who sit throughout the day']
  },
  {
    id: 'ex_groin_stretch', name: 'Groin Stretch',
    primaryMuscle: 'glutes', secondaryMuscles: ['quads'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand in a wide stance, toes pointed out at 45 degrees','Lower your body by bending one knee while keeping the other leg straight','Feel stretch in the inner thigh of the straight leg','Hold 20-30 seconds, then switch sides'],
    tips: ['Similar to a side lunge stretch — keep back flat','Deeper stance = more intense stretch','Progress to seated straddle or frog stretch for deeper work']
  },
  {
    id: 'ex_frog_stretch', name: 'Frog Stretch',
    primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'intermediate',
    instructions: ['Start on all fours, then walk knees wide out to sides','Toes can point out to align with knees','Lower hips toward floor — feel a deep groin and hip stretch','Rock gently forward and back to work through tightness'],
    tips: ['One of the deepest groin and inner hip stretches available','Move slowly — this is an advanced stretch for many people','Progress by working into deeper hip sinks over time']
  },
  {
    id: 'ex_figure_four_stretch', name: 'Figure Four Stretch',
    primaryMuscle: 'glutes', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Lie on back, feet flat, knees bent','Cross one ankle over the opposite knee, forming a figure 4','Either hold this position or pull the lower leg toward your chest','Hold 30-45 seconds each side'],
    tips: ['Targets the piriformis and deep external rotators of the hip','A gentler alternative to pigeon pose','Great pre- and post-squat stretch for hip internal rotation']
  },
  {
    id: 'ex_standing_side_bend_stretch', name: 'Standing Side Bend Stretch',
    primaryMuscle: 'core', secondaryMuscles: ['back'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand feet shoulder-width, raise one arm overhead','Lean toward the opposite side in a long arc','Feel the stretch down the entire side of the body from fingertips to hip','Hold 20-30 seconds and switch sides'],
    tips: ['Keep both feet flat on the floor for the full lateral stretch','Do not lean forward or backward — purely lateral','Reaching the arm further overhead increases the stretch intensity']
  },
  {
    id: 'ex_seated_spinal_twist', name: 'Seated Spinal Twist',
    primaryMuscle: 'back', secondaryMuscles: ['core'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Sit tall, one leg extended, other foot flat outside extended knee','Place opposite elbow on the outside of the bent knee for leverage','Rotate torso toward the bent knee, looking over the back shoulder','Hold 30-45 seconds each side'],
    tips: ['Sit as tall as possible before rotating — length first, then twist','Great thoracic and lumbar rotation stretch','A yoga staple that translates well to athletic performance']
  },
  {
    id: 'ex_cobra_stretch', name: 'Cobra Stretch',
    primaryMuscle: 'core', secondaryMuscles: ['back', 'chest'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Lie face down, hands under shoulders like a push-up','Press hands into floor and lift chest, keeping hips on the floor','Extend through the spine, looking forward or slightly up','Hold 20-30 seconds, breathe into the abdomen'],
    tips: ['Keep hips on the floor — this is not a push-up','Progress from low cobra (elbows bent) to full cobra (arms straight)','Excellent post-deadlift and squat spinal extension stretch']
  },
  {
    id: 'ex_quad_stretch', name: 'Quadriceps Stretch',
    primaryMuscle: 'quads', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand on one leg, use wall or chair for balance if needed','Bend free leg at knee, pull heel toward glute with same-side hand','Keep knees together and stand tall','Hold 20-30 seconds each side'],
    tips: ['Tuck the pelvis under slightly to increase the stretch into the hip flexor','Do not let the knee flare outward — keep knees aligned','Great post-leg day stretch and pre-run warm-up']
  },
  {
    id: 'ex_standing_hamstring_stretch', name: 'Standing Hamstring Stretch',
    primaryMuscle: 'hamstrings', secondaryMuscles: ['back'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand and place one heel on an elevated surface at hip height','Hinge forward from the hips keeping back flat','Lean over the elevated leg until you feel a stretch along the hamstring','Hold 20-30 seconds each side'],
    tips: ['Flat back is essential — rounding defeats the purpose','Progress by raising the surface height as flexibility improves','Can also be done seated with one leg extended on the floor']
  },
  {
    id: 'ex_standing_toe_touch', name: 'Standing Toe Touch',
    primaryMuscle: 'hamstrings', secondaryMuscles: ['back'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand feet hip-width, soft bend in knees','Hinge forward slowly, letting arms hang down toward the floor','Go as far as comfortable, feeling hamstring stretch','Hold at end range 20-30 seconds, slowly roll back up'],
    tips: ['Bend the knees if hamstrings are very tight','Do not bounce — hold steady at the end range','A good measure of overall posterior chain flexibility']
  },
  {
    id: 'ex_supine_hamstring_stretch', name: 'Supine Hamstring Stretch',
    primaryMuscle: 'hamstrings', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Lie on back, extend one leg to ceiling','Keep other leg flat on floor or bent at knee','Pull raised leg toward you with hands behind the thigh or calf','Hold 30-45 seconds each side'],
    tips: ['Resistance band around the foot allows a more relaxed hold','Keep the lower back pressed into the floor','Progress by straightening both legs for a PNF-style stretch']
  },
  {
    id: 'ex_calf_stretch', name: 'Standing Calf Stretch',
    primaryMuscle: 'quads', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Place hands on wall, step one foot back into a split stance','Keep back leg straight and heel flat on floor','Lean forward until you feel stretch in the calf of the back leg','Hold 30 seconds, then bend back knee slightly for the Achilles/soleus'],
    tips: ['Two stretches in one: straight knee = gastrocnemius, bent knee = soleus','Do both variations after running, jumping, or calf work','Great for reducing DOMS after leg day']
  },
  {
    id: 'ex_ankle_circles', name: 'Ankle Circles',
    primaryMuscle: 'quads', secondaryMuscles: [],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Sit or stand, lift one foot slightly off floor','Draw large circles with the foot — 10 clockwise, 10 counter-clockwise','Make the circles as large as possible to take ankle through full range','Switch feet and repeat'],
    tips: ['Great pre-workout warm-up for ankles and lower leg joints','Also useful in rehabilitation after ankle sprains','Can be done seated — great for those with limited mobility']
  },
  {
    id: 'ex_full_body_reach', name: 'Full Body Reach Stretch',
    primaryMuscle: 'core', secondaryMuscles: ['back', 'shoulders'],
    equipment: 'bodyweight', category: 'mobility', movementType: 'mobility', difficulty: 'beginner',
    instructions: ['Stand with feet together, raise both arms overhead','Rise up on tiptoes and reach as high as possible with your whole body','Hold at maximum extension 2-3 seconds','Lower back to flat feet and relax, repeat 5-8 times'],
    tips: ['Best done after static stretching to feel the whole body connected','Interlace fingers and flip palms upward for maximum shoulder elevation','A great post-workout reset movement for the entire spine']
  }
];

// Deduplicate
let added = 0;
for (const ex of newExercises) {
  if (!existingIds.has(ex.id) && !existingNames.has(ex.name.toLowerCase())) {
    existing.push(ex);
    added++;
  } else {
    console.log('SKIP (exists):', ex.name);
  }
}

fs.writeFileSync(file, JSON.stringify(existing, null, 2));
console.log('\nAdded', added, 'exercises. Total:', existing.length);
