/** Object-specific modelling decisions. Rectangles are inclusive [left, top, right, bottom]
 * in the original 32×32 art. Details override only occupied art pixels, never the silhouette.
 * 'material' is an original palette key (raster order) or a hex colour. */
export type Shape = 'box' | 'round' | 'lathe' | 'disc' | 'wedge' | 'ridge' | 'tube' | 'pyramid' | 'roll';
export type Pattern = 'plain' | 'bands' | 'staves' | 'seams' | 'spots' | 'lobes' | 'earth' | 'faberge' | 'igloo' | 'panels' | 'grain';
export interface Detail { label: string; rect: [number, number, number, number]; depth: number; shape?: Shape; material?: string; at?: number; pattern?: Pattern; colors?: string[]; surface?: boolean }
export interface Recipe { shape: Shape; depth: number; about: string; material?: string; pattern?: Pattern; details?: Detail[]; bodyBounds?: Detail['rect']; wrapColors?: string[] }
const d = (label: string, rect: Detail['rect'], depth: number, shape: Shape = 'box', material?: string, at?: number): Detail => ({ label, rect, depth, shape, material, at });
const r = (shape: Shape, depth: number, about: string, details: Detail[] = [], pattern: Pattern = 'plain', material?: string): Recipe => ({ shape, depth, about, details, pattern, material });

// Every name has a deliberate recipe; there is no catch-all/default head recipe.
export const recipes: Record<string, Recipe> = {
'aardvark': r('round',8,'Rounded aardvark skull with a projecting long muzzle and thin upright ears.',[d('ears',[10,0,22,8],2),d('muzzle',[19,14,30,20],8,'round')]),
'abstract': r('box',3,'Thin painted panel with a plain dark reverse; the Mondrian composition belongs on the front.',[], 'plain','#1b1b1b'),
'action-cam': r('box',6,'Compact camera housing with a raised lens, recessed display and rear service panel.',[d('display',[7,9,15,16],4,'box',undefined,1),d('lens',[24,6,28,10],6,'disc')],'panels'),
'ape': r('round',8,'Rounded ape cranium, shallow crown hair and a projecting jaw; no face repeated on the back.',[d('jaw',[9,12,26,20],8,'round'),d('crown',[8,4,24,8],5,'round')]),
'bag': r('round',6,'Soft handbag body with a shallow loop handle and raised clasp.',[d('handle',[8,1,24,7],1),d('clasp',[13,8,19,11],6)]),
'bagpipe': r('round',8,'Inflated bag with individual one-voxel pipes and chanter.',[d('pipes',[14,0,27,11],1),d('chanter',[5,6,8,27],1)]),
'banana': r('round',6,'Peeled banana with a full central fruit and three thinner, curling peel lobes.',[d('left peel',[3,9,10,20],2,'round'),d('right peel',[23,9,29,20],2,'round'),d('stem',[8,1,18,4],2)]),
'bank': r('box',8,'Stone bank with a pitched pediment, stepped plinth and recessed column bays.',[d('pediment',[5,0,27,7],8,'ridge'),d('colonnade',[8,8,24,18],6,'box',undefined,2)]),
'baseball-gameball': r('round',18,'Spherical baseball with two red seam paths continuing around the leather.',[],'seams'),
'basketball': r('round',18,'Spherical basketball with equatorial and meridian channels.',[],'seams'),
'bat': r('round',7,'Bat face with separate thin pointed ears and shallow wings.',[d('left wing',[2,10,8,22],2),d('right wing',[24,10,29,22],2),d('ears',[7,0,25,8],2)]),
'bear': r('round',8,'Brown bear skull with shallow ears and a raised muzzle.',[d('ears',[6,3,24,7],3,'round'),d('muzzle',[11,16,23,21],8,'round')]),
'beer': r('lathe',14,'Round beer stein, foamy crown and a thin open side handle.',[d('handle',[5,8,9,20],1),d('foam',[8,2,24,8],14,'round')],'bands'),
'beet': r('round',16,'Rounded beetroot with a one-voxel stalk and leaf.',[d('leaves',[13,0,22,7],1)]),
'bell': r('lathe',16,'Rotational bell with a flared lower rim and narrow top knob.',[],'bands'),
'bigfoot-yeti': r('round',8,'White yeti with a rounded body, shallow arms and narrow feet.',[d('left arm',[3,7,12,18],3),d('right arm',[21,9,31,18],3),d('feet',[8,20,25,24],2)]),
'bigfoot': r('round',8,'Brown bigfoot, rounded torso and head, short projecting arms and feet.',[d('arms',[2,9,30,15],5,'round'),d('feet',[7,20,28,24],3)]),
'blackhole': r('disc',5,'Dark recessed centre with a raised accretion rim; isolated sparks remain separate art components.',[d('event horizon',[11,9,21,18],2,'disc',undefined,2)]),
'blueberry': r('round',16,'Spherical blueberry with a recessed crown scar and a plain blue reverse.',[d('crown scar',[14,3,22,8],10,'round',undefined,3)]),
'bomb': r('round',8,'Compact round bomb with a thin fuse and spark, not a slab above the shell.',[d('fuse and spark',[14,0,29,9],1)]),
'bonsai': r('round',8,'Bonsai with separate rounded foliage pads, a slender trunk and rectangular planter.',[d('planter',[7,19,24,23],8),d('trunk',[11,12,25,19],2),d('upper canopy',[11,0,24,8],7,'round')]),
'boombox': r('box',6,'Portable stereo with a thin carry handle, raised speaker rims and a plain rear casing.',[d('handle',[5,2,25,5],1),d('cord',[24,17,26,31],1)],'panels'),
'boot': r('round',8,'Boot with a rounded shaft, extended toe and flat full-depth sole.',[d('sole',[7,19,28,22],8)]),
'box': r('box',10,'Cardboard carton with shallow folded top flaps and a taped rear seam.',[d('flaps',[4,4,29,9],2)],'plain'),
'boxing-glove': r('round',10,'Padded boxing glove with a projecting thumb and a squared cuff.',[d('thumb',[4,9,10,18],6,'round'),d('cuff',[8,18,25,22],7)]),
'brain': r('round',12,'Rounded brain with shallow winding grooves across its crown and back.',[],'lobes'),
'bubble-speech': r('disc',3,'Thin speech bubble with its tail in the same shallow plane.'),
'bubblegum': r('round',18,'Round inflated bubble, with the highlight confined to the original front.'),
'burger-dollar-menu': r('lathe',16,'Round burger with bun, patty and cheese bands continuing around every side.',[],'bands'),
'cake': r('lathe',16,'Cylindrical iced cake with continuous icing bands and three one-voxel candles.',[d('candles',[8,0,24,8],1)],'bands'),
'calculator': r('box',4,'Thin calculator with recessed display, raised key bed and a plain rear battery cover.',[d('display',[8,14,24,18],3,'box',undefined,1)],'panels'),
'calendar': r('box',3,'Thin calendar pages with a shallow top binding and plain paper reverse.',[d('binding',[7,5,26,8],3)],'plain','#f4f4f4'),
'camcorder': r('box',8,'Camcorder body with a projecting cylindrical lens and thin hand strap.',[d('lens',[22,7,28,20],6,'tube'),d('strap',[5,15,23,20],3)],'panels'),
'canned-ham': r('box',7,'Rounded rectangular ham tin with circumferential label bands and a thin pull tab.',[d('pull tab',[14,1,24,7],1)],'bands'),
'capybara': r('round',9,'Capybara with a rounded barrel body and distinct muzzle at the right.',[d('muzzle',[21,7,27,17],7,'round'),d('feet',[9,18,24,21],3)]),
'car': r('box',8,'Side-view car with a narrower cabin, full-width lower body and recessed window glazing.',[d('cabin',[7,9,23,14],6,'round'),d('wheels',[6,18,26,21],8,'tube')]),
'cash-register': r('box',8,'Cash register with a shallow raised display, sloped keyboard and full-depth drawer.',[d('display',[10,3,24,9],3),d('receipt',[6,0,12,10],1),d('key deck',[6,10,24,16],8,'wedge')],'panels'),
'cassette-tape': r('box',3,'Thin cassette shell, front-only reel windows and a plain rear shell with inset label.',[],'panels'),
'cat': r('round',7,'Dark cat head with thin pointed ears and a projecting pale muzzle.',[d('ears',[7,3,25,9],2),d('muzzle',[6,18,26,21],7,'round')]),
'cd': r('disc',1,'One-voxel optical disc; preserves the hub opening and radial colours on both faces.'),
'chain': r('tube',2,'Thin individual chain links. The separated upper and lower strands require external support.'),
'chainsaw': r('box',6,'Compact saw motor, shallow toothed cutting bar and one-voxel top handle.',[d('handle',[4,3,13,8],1),d('cutting bar',[13,7,30,20],2)],'panels'),
'chameleon': r('round',9,'Rounded chameleon head with separate raised eye turrets and a narrow crest.',[d('crest',[14,1,19,8],2),d('eyes',[5,6,27,11],9,'round')]),
'chart-bars': r('box',5,'Five separate square-section columns, with their own colours carried through the depth.',[],'grain'),
'cheese': r('wedge',8,'Triangular cheese wedge with thickness tapering toward the point and a plain cut reverse.'),
'chefhat': r('round',10,'Puffy chef hat over a cylindrical folded band.',[d('band',[10,15,23,21],8,'lathe')],'lobes'),
'cherry': r('round',14,'Two rounded cherry lobes connected by a one-voxel stalk and leaf.',[d('stalk and leaf',[9,0,24,8],1)]),
'chicken': r('round',8,'Rounded chicken skull with a thin comb and short projecting beak.',[d('comb',[15,0,24,7],2),d('beak',[20,15,27,18],4)]),
'chilli': r('round',7,'Tapered curved chilli with a thin green stem and narrow tip.',[d('stem',[7,1,25,7],1),d('tip',[23,15,31,22],2,'round')]),
'chipboard': r('box',3,'Thin circuit board with components raised on its front and a sparse copper-track reverse.',[],'panels'),
'chips': r('round',5,'Puffed packet with thin sealed edges and individual loose crisps.',[d('seals',[4,2,26,6],1),d('loose crisps',[22,18,29,25],1)]),
'chocolate': r('box',3,'Chocolate slab with a thin wrapper and raised chocolate squares.',[d('chocolate',[8,2,23,10],3)],'bands'),
'cloud': r('round',9,'Soft cloud assembled from rounded shallow lobes rather than a flat extrusion.',[],'lobes'),
'clover': r('disc',2,'Four shallow leaf lobes with a one-voxel stem.',[d('stem',[16,15,27,23],1)]),
'clutch': r('box',4,'Slim clutch purse with a raised clasp and continuous edge seam.',[],'plain'),
'coffee-bean': r('round',10,'Oval coffee bean with the centre groove carried across the back.',[],'lobes'),
'cone': r('lathe',16,'Traffic cone with a tapering round body, continuous white band and square base.',[d('base',[7,19,25,22],16)],'bands'),
'console-handheld': r('box',5,'Handheld console with a recessed screen, raised controls, plain rear casing, battery hatch and vent slots.',[d('screen',[9,5,23,15],4,'box','a',1)],'panels','a'),
'cookie': r('disc',4,'Thick baked cookie with a rounded edge, chocolate chips on the front and crumb on the reverse.',[],'spots'),
'cordless-phone': r('box',4,'Slim handset with a projecting antenna, shallow keypad and rear battery cover.',[d('antenna',[5,6,12,11],1)],'panels'),
'cotton-ball': r('round',12,'Fluffy cotton ball with a rounded core; isolated fibres retain their exact pixel positions.'),
'couch': r('box',9,'Couch with a shallow backrest, projecting seat and full-depth arms.',[d('backrest',[8,7,24,14],3,'box',undefined,6),d('seat',[7,15,25,21],9),d('left arm',[3,12,8,20],9),d('right arm',[24,12,29,20],9)]),
'cow': r('round',8,'White cow head with black coat patches, shallow ears and a projecting pink muzzle.',[d('ears',[5,7,27,11],3),d('muzzle',[8,16,25,21],8,'round')],'spots','#f4f4f4'),
'crab': r('round',7,'Rounded crab carapace with separate shallow pincers and narrow arms.',[d('claws',[4,4,29,12],3,'round')]),
'crane': r('round',7,'Crane head with a shallow crown and a long thin beak.',[d('beak',[19,10,31,13],2),d('crest',[7,3,23,7],2)]),
'croc-hat': r('lathe',9,'Cylindrical green crown under a wide thin dark brim.',[d('brim',[6,5,27,7],2)],'bands'),
'crown': r('lathe',14,'Circular crown with a continuous gold band and thin raised points.',[d('points',[6,1,26,9],2)],'bands'),
'crt-bsod': r('box',12,'CRT monitor with a deep tapered rear housing, recessed blue screen and back ventilation.',[d('screen',[10,5,24,16],10,'box',undefined,1)],'panels'),
'crystal-ball': r('round',18,'Spherical purple crystal on a short circular pedestal.',[d('stand',[9,18,24,21],12,'lathe')]),
'diamond-blue': r('wedge',12,'Blue faceted gemstone, broad at the girdle and tapering to crown and pavilion.',[],'bands'),
'diamond-red': r('wedge',12,'Red faceted gemstone, broad at the girdle and tapering to crown and pavilion.',[],'bands'),
'dictionary': r('ridge',5,'Open book with two angled page blocks and a recessed centre binding.',[d('spine',[15,5,17,20],5)],'plain','#f4f4f4'),
'dino': r('round',8,'Green dinosaur skull with a long rounded jaw and shallow top crest.',[d('crest',[9,3,18,7],2),d('jaw',[6,15,27,21],8,'round')]),
'dna': r('tube',5,'Two helically offset rails with thin connecting rungs; open spaces remain open.'),
'dog': r('round',8,'Rounded dog head with pendant thin ears and a forward muzzle.',[d('left ear',[6,6,10,17],3),d('right ear',[24,6,27,17],3),d('muzzle',[14,16,25,21],8,'round')]),
'doughnut': r('tube',7,'Thick doughnut ring with pink icing on its front and baked dough on its reverse.',[],'plain','#d09168'),
'drill': r('round',7,'Rounded drill casing with a thin metal bit and a squared handle and battery.',[d('bit',[24,8,31,12],1),d('handle',[11,15,20,22],5)]),
'duck': r('round',8,'White duck skull with a projecting flat yellow bill.',[d('bill',[9,17,25,21],8)],'plain','#f4f4f4'),
'ducky': r('round',10,'Rubber duck with a rounded body and head, shallow beak and tail.',[d('beak',[24,6,30,9],2),d('tail',[3,13,8,19],3)]),
'dumpling': r('round',10,'Plump dumpling with a thinner crimped crown and soft curved reverse.',[d('crimp',[9,3,24,7],3)],'lobes'),
'earth': r('round',18,'Spherical Earth with blue oceans and stylised green continents on the unseen hemisphere.',[],'earth'),
'egg': r('lathe',16,'Egg-shaped solid with a narrow crown and wider lower half; the face stays on the front.'),
'faberge': r('lathe',18,'Rotational enamel egg with a continuous gold equator, repeating jewel lattice and small foot.',[d('foot',[10,19,23,20],10,'lathe')],'faberge','b'),
'factory-dark': r('box',8,'Industrial shed with a sawtooth roof, narrow chimneys and front-only windows.',[d('chimneys',[5,1,27,7],3)],'panels'),
'fan': r('disc',5,'Shallow circular fan cage with front blades and a compact rear motor hub.',[d('motor',[13,10,20,17],5,'disc')]),
'fence': r('box',3,'Thin picket fence with shallow posts; its timber colours continue through each picket.',[],'grain'),
'film-35mm': r('lathe',12,'Round film cartridge with continuous label and metal cap bands.',[],'bands'),
'film-strip': r('box',1,'One-voxel film ribbon, preserving sprocket holes and transparent-looking frames.'),
'fir': r('lathe',14,'Conical tiered fir with a narrow trunk and foliage continuing around the back.',[d('trunk',[13,18,18,23],3)],'bands'),
'firehydrant': r('lathe',12,'Round hydrant barrel with a dome, full collar rings and shallow side outlets.',[d('outlets',[4,12,28,17],6,'tube')],'bands'),
'flamingo': r('tube',4,'Slender flamingo neck and bill over a fuller rounded lower body.',[d('body',[5,17,25,22],7,'round')]),
'flower': r('disc',3,'Shallow blossom petals around a raised centre, with narrow green stem.',[d('centre',[11,9,22,19],4,'disc'),d('stem',[14,20,19,25],1)]),
'fox': r('round',7,'Rounded fox with a thick torso, thin legs and a bushy tail.',[d('legs',[10,19,29,25],2),d('tail',[1,7,13,15],5,'round')]),
'frog': r('round',8,'Wide rounded frog head with raised eye bumps and a broad shallow lower jaw.',[d('eyes',[7,6,24,10],6,'round')]),
'garlic': r('lathe',14,'Garlic bulb with vertically divided cloves and a narrow top stalk.',[d('stalk',[13,3,18,8],1)],'lobes'),
'gavel': r('lathe',14,'Round vertical mallet head with metal end rings and a thin lateral handle.',[d('handle',[2,10,10,17],2)],'bands'),
'ghost': r('round',7,'Soft ghost with a rounded head and sheet body, narrowing into shallow arms and wisps.',[d('arms',[3,7,29,14],3,'round'),d('tail',[1,20,14,25],2)]),
'glasses-big': r('box',2,'Thin spectacle rims with side arms; keeps both large lens openings clear.'),
'gnome': r('round',8,'Gnome with a conical cap, cylindrical face and a projecting beard and brim.',[d('cap',[9,1,23,9],9,'lathe'),d('brim',[6,9,27,12],10)]),
'goat': r('round',8,'Rounded goat with thin horns, ears and narrow legs.',[d('horns',[8,2,27,7],1),d('legs',[4,20,29,27],2)]),
'gold-coin': r('disc',3,'Thin gold coin with a raised perimeter rim and a plain reverse.'),
'goldfish': r('lathe',18,'Round fishbowl with a narrow rim and a water body; the fish remains a front feature.',[d('rim',[9,3,24,5],12,'lathe')],'plain','#36aebf'),
'grouper': r('round',9,'Rounded grouper body with a shallow dorsal fin and thin projecting mouth.',[d('dorsal fin',[5,4,23,8],2),d('mouth',[24,11,30,17],3)]),
'hair': r('tube',4,'Curved locks of hair with narrow strand depth and open central silhouette.',[],'grain'),
'hanger': r('tube',1,'Single-voxel wire hanger, including the hook; its interior remains entirely open.'),
'hard-hat': r('lathe',14,'Domed hard hat with a projecting brim and crown rib.',[d('brim',[8,18,26,21],16)],'plain','#f2cd37'),
'heart': r('round',9,'Puffy sculpted heart with two rounded lobes and a narrowing lower point.'),
'helicopter': r('round',8,'Rounded helicopter fuselage with one-voxel rotor, shallow tail and landing skids.',[d('rotor',[5,2,28,5],1),d('tail',[3,9,12,16],2),d('skids',[9,20,25,23],1)]),
'helmet': r('round',14,'Rounded helmet shell with a recessed visor; the visor does not repeat on the back.',[d('visor',[9,11,24,16],10,'round',undefined,2)],'plain','#1b1b1b'),
'highheel': r('round',6,'Sculpted high heel with a thin heel post and long shallow sole.',[d('heel',[7,15,12,23],2),d('sole',[8,20,29,23],3)]),
'hockey-puck': r('lathe',18,'Short round puck with continuous side grooves and a flat top.',[],'bands'),
'horse-deep-fried': r('round',8,'Rounded golden horse head with a projecting long muzzle and shallow mane.',[d('muzzle',[18,14,30,20],8,'round'),d('mane',[4,5,10,19],3)]),
'hotdog': r('round',8,'Long rounded bun and sausage, with the mustard detail confined to the front.',[],'grain'),
'house': r('box',10,'House with a pitched roof, thin chimney and plain walls on the rear.',[d('roof',[5,3,28,11],10,'ridge'),d('chimney',[8,2,13,8],3)],'plain'),
'icepop': r('round',4,'Shallow rounded ice lolly with a one-voxel wooden stick.',[d('stick',[3,10,10,16],1)],'grain'),
'igloo': r('lathe',18,'Domed igloo with staggered block seams wrapping the dome.',[],'igloo'),
'index-card': r('box',1,'Single-voxel index card with a plain paper back; coloured rules are front-only.',[],'plain','#f4f4f4'),
'island': r('lathe',12,'Rounded sand island with a slender palm trunk and thin palm fronds.',[d('trunk',[15,7,19,19],2),d('fronds',[9,1,27,10],1)],'plain','#f2cd37'),
'jellyfish': r('round',12,'Rounded jellyfish bell with one-voxel hanging tentacles.',[d('tentacles',[5,17,28,29],1)]),
'jupiter': r('round',18,'Spherical Jupiter with cloud belts continuing around the planet.',[],'bands'),
'kangaroo': r('round',8,'Kangaroo skull with thin upright ears and a projecting muzzle.',[d('ears',[4,0,26,9],2),d('muzzle',[15,14,28,21],8,'round')]),
'ketchup': r('box',7,'Squeezable ketchup bottle with a narrow conical nozzle and continuous cap.',[d('nozzle',[12,2,21,8],3,'lathe')],'bands'),
'laptop': r('box',3,'Thin laptop lid with recessed display and a projecting keyboard ledge.',[d('screen',[8,7,24,17],2,'box',undefined,1),d('keyboard',[6,18,26,21],6)],'panels'),
'lightning-bolt': r('box',2,'Shallow lightning symbol with the original stepped silhouette.'),
'lint': r('round',8,'Soft rounded lint core with shallow surrounding fibres.'),
'lips': r('tube',5,'Rounded upper and lower lips, preserving the open mouth through the model.'),
'lipstick': r('lathe',10,'Round lipstick tube with continuous dark sleeve and gold collar.',[d('lipstick tip',[12,2,21,8],7,'lathe')],'bands'),
'lock': r('box',6,'Solid padlock body with a thin open shackle.',[d('shackle',[8,3,25,9],2)],'plain'),
'macaroni': r('tube',8,'Curved macaroni tube with two open-looking end rims and a rounded elbow.'),
'mailbox': r('box',9,'Rounded-top mailbox housing with a thin side flag and shallow open door.',[d('flag',[16,3,21,17],1),d('open door',[22,13,31,18],2)],'panels'),
'maze': r('box',3,'Thin maze board with raised front channels and a plain reverse.'),
'microwave': r('box',9,'Microwave cabinet with recessed door and controls, rear vents and a narrow power cord.',[d('door',[8,5,23,17],8,'box',undefined,1),d('cord',[2,16,6,27],1)],'panels'),
'milk': r('box',8,'Milk carton with a pitched folded gable and thin top seam.',[d('gable',[6,2,25,9],8,'ridge'),d('top seam',[7,1,24,3],1)],'bands'),
'mirror': r('box',2,'Thin framed mirror; the reflection appears only on the front.',[],'plain','#958a73'),
'mixer': r('box',5,'Audio mixer with shallow raised knobs and a rear service panel.',[d('knobs',[5,1,27,5],2)],'panels'),
'moon': r('round',18,'Spherical moon with scattered subtle craters on the unseen hemisphere.',[],'spots'),
'moose': r('round',8,'Rounded moose skull, shallow branching antlers and broad projecting muzzle.',[d('antlers',[1,1,30,10],2),d('muzzle',[12,15,26,21],8,'round')]),
'mosquito': r('round',6,'Rounded insect abdomen with slender legs, antenna and one-voxel proboscis.',[d('antenna',[9,1,20,8],1),d('proboscis',[22,15,31,17],1),d('legs',[6,20,23,24],1)]),
'mountain-snowcap': r('lathe',16,'Conical mountain with snow at the summit continuing over its rear slopes.',[],'bands'),
'mouse': r('round',8,'Rounded mouse skull, two shallow large ears and a projecting snout.',[d('ears',[4,2,25,10],3),d('snout',[18,13,29,20],6,'round')]),
'mug': r('lathe',16,'Round mug with a continuous rim, thin open handle and one-voxel steam wisps.',[d('handle',[3,9,9,18],1),d('steam',[10,1,24,7],1)],'plain','#f4f4f4'),
'mushroom': r('lathe',18,'Broad rounded mushroom cap over a narrow cylindrical stalk, with cap spots around the back.',[d('stalk',[11,12,23,21],8,'lathe')],'spots'),
'mustard': r('box',7,'Squeezable mustard bottle with a narrow nozzle and full cap band.',[d('nozzle',[12,2,21,8],3,'lathe')],'bands'),
'nigiri': r('round',8,'Rounded rice block under a full-width salmon topping with bands across its crown.',[d('salmon',[5,4,28,9],9,'round')],'bands'),
'noodles': r('lathe',16,'Round bowl with continuous rim bands, raised noodles and thin chopsticks.',[d('food',[6,3,26,10],7,'round'),d('chopsticks',[9,0,22,7],1)],'bands'),
'nountie-hat': r('lathe',14,'Rounded felt hat crown with a thin wide brim and continuous band.',[d('brim',[5,15,28,18],16)],'bands'),
'onion': r('lathe',16,'Onion bulb with vertical skin divisions around its circumference and a thin dried stalk.',[d('stalk',[14,1,19,6],1)],'lobes'),
'orangutan': r('round',9,'Rounded dark orangutan face surrounded by red hair; only fur appears on the reverse.',[d('muzzle',[12,14,24,20],9,'round')],'plain','#d33925'),
'orca': r('round',9,'Rounded orca body with a thin dorsal fin, tail and flippers.',[d('dorsal',[15,1,23,9],2),d('tail',[1,11,9,21],2)]),
'otter': r('round',8,'Rounded otter head with a short pale muzzle.',[d('muzzle',[13,16,25,21],8,'round')]),
'outlet': r('box',3,'Thin socket plate with recessed front sockets and a plain rear mounting plate.'),
'owl': r('round',10,'Rounded owl skull and body with shallow facial discs and a narrow folded wing.',[d('wing',[5,11,12,21],4,'round')]),
'oyster': r('round',7,'Two shallow shell valves around a projecting pearl, with ridged shell backs.',[d('pearl',[13,16,20,20],7,'round')],'lobes'),
'paintbrush': r('box',5,'Flat brush with shallow bristles, ferrule, handle and one-voxel paint drip.',[d('bristles',[2,9,14,19],3),d('drip',[25,18,28,25],1)],'grain'),
'panda': r('round',9,'White panda skull with shallow dark ears and a plain white rear coat.',[d('ears',[6,5,25,9],3)],'plain','#f4f4f4'),
'paperclip': r('tube',1,'Single-voxel bent wire paperclip, with all interior gaps kept open.'),
'peanut': r('tube',7,'Rounded peanut with two lobes, a narrow waist and textured shell on the reverse.',[],'lobes'),
'pencil-tip': r('lathe',12,'Conical sharpened pencil with a wood taper, graphite point and coloured barrel base.',[],'bands'),
'peyote': r('lathe',16,'Rounded cactus dome with radial ribs, rim and a thin crown blossom.',[d('flower',[13,0,20,6],1)],'lobes'),
'piano': r('box',9,'Piano with a deep sound box, thin raised lid and projecting shallow keyboard.',[d('lid',[11,2,25,9],2),d('keyboard',[5,17,28,21],9)],'panels'),
'pickle': r('round',9,'Rounded pickle with scattered skin bumps continuing across its reverse.',[],'spots'),
'pie': r('lathe',16,'Round pie with a continuous fluted tin and crust, and thin steam strands.',[d('steam',[11,0,23,7],1)],'bands'),
'piggybank': r('round',12,'Plump piggy bank with shallow ears, snout, feet and a narrow top coin.',[d('coin',[14,2,20,5],1),d('ears',[22,3,28,9],2),d('feet',[8,18,25,22],3)]),
'pill': r('round',10,'Rounded capsule with its two material halves continuing through the depth.',[],'grain'),
'pillow': r('round',6,'Soft shallow pillow with a full centre, compressed seams and thin pinched corners.',[d('upper seam',[6,4,27,6],2),d('lower seam',[6,19,27,21],2)]),
'pineapple': r('lathe',14,'Round pineapple with a textured rind and thin crown leaves.',[d('crown',[11,1,22,7],1)],'spots'),
'pipe': r('round',6,'Smoking pipe with a deep bowl and narrow curved stem.',[d('bowl',[3,7,12,21],9,'lathe'),d('stem',[11,16,27,23],2)]),
'pirateship': r('round',7,'Rounded wooden hull with a thin mast, sails and flags.',[d('sails and rigging',[6,1,28,15],1),d('hull',[2,16,30,23],8,'round')],'bands'),
'pizza': r('box',3,'Thin pizza slice with a thicker raised crust; topping artwork is front-only.',[d('crust',[4,18,28,21],4)],'plain','#e4cd9e'),
'plane': r('round',6,'Rounded aircraft fuselage with shallow wings, tail and one-voxel landing gear.',[d('wing',[10,8,27,12],2),d('undercarriage',[3,18,29,21],1)]),
'pop': r('lathe',12,'Cylindrical soda can with metal end rims and label colours wrapped around the shell.',[],'bands'),
'potato': r('round',10,'Rounded irregular potato with skin spots on the reverse.',[],'spots'),
'puffer-fish': r('round',14,'Inflated round puffer fish with short shallow spines and side fins.',[d('left fins',[3,10,8,19],2),d('right fins',[24,10,30,19],2)]),
'pumpkin': r('lathe',16,'Round pumpkin with vertical ribs continuing around it and a short thin stalk.',[d('stalk',[14,2,19,6],2)],'lobes'),
'pyramid': r('pyramid',18,'Four-sided stepped pyramid, increasing in depth toward its square base.'),
'queen-crown': r('lathe',14,'Royal crown with a round lower band and shallow gold arches over its cap.',[d('arches',[7,1,26,10],3)],'bands'),
'rabbit': r('round',7,'Grey rabbit head with long ears kept shallow and a small forward muzzle.',[d('ears',[7,3,25,13],2),d('muzzle',[8,17,24,21],7,'round')]),
'rainbow': r('box',3,'Thin rainbow arch with band colours carried through its thickness.',[],'grain'),
'range-finder': r('box',6,'Compact rangefinder camera with a raised top control strip and a plain rear panel.',[d('top controls',[6,4,26,8],4)],'panels'),
'raven': r('round',8,'Rounded raven skull with a shallow beak and tapered tail feathers.',[d('beak',[23,15,30,18],2),d('tail',[20,18,29,21],3)]),
'retainer': r('disc',3,'Shallow curved dental retainer with its open wire spaces preserved.'),
'rgb': r('tube',4,'Rounded three-colour ring with material segments continuing through the depth.',[],'grain'),
'ring': r('tube',3,'Thin gold ring with a raised gem setting; the centre remains open.',[d('gem',[12,1,21,7],5,'wedge')]),
'road': r('box',3,'Thin road slab; markings stay on the visible road face and the reverse is asphalt.',[],'plain','#525b5e'),
'robot': r('box',8,'Robot head with shallow ears, top cap, rear seams and a front-only face.',[d('ears',[1,10,6,18],3),d('top cap',[10,2,24,7],6)],'panels'),
'rock': r('wedge',10,'Angular rock with stepped facets rather than a rounded or rectangular extrusion.'),
'rose-bud': r('round',8,'Rounded rosebud above shallow green sepals and a thin stalk.',[d('stem',[13,14,19,23],1)]),
'ruler-triangular': r('box',2,'Thin triangular set square with its inner opening retained through the thickness.'),
'saguaro': r('lathe',7,'Cactus with separate narrow round arms and a thicker central column.',[d('left arm',[6,6,11,16],3,'lathe'),d('right arm',[22,5,28,17],3,'lathe')],'lobes'),
'sailboat': r('round',7,'Rounded hull under a one-voxel sail and mast.',[d('sail and mast',[6,1,26,17],1),d('hull',[3,18,29,23],7,'round')],'bands'),
'sandwich': r('box',7,'Layered sandwich with rounded bread and continuous filling bands on the cut sides.',[d('top bread',[6,7,27,12],7,'round')],'bands'),
'saturn': r('round',16,'Spherical Saturn with a one-voxel surrounding ring and detached orbital fragments.',[d('ring',[2,15,30,24],1)]),
'saw': r('box',2,'Thin steel saw blade with a thicker wooden handle and open grip.',[d('handle',[2,7,13,20],4)]),
'scorpion': r('round',6,'Rounded scorpion body with a narrow segmented tail, shallow claws and legs.',[d('tail',[6,1,23,14],2),d('legs',[8,18,29,23],1)]),
'shark': r('round',9,'Rounded shark body with a thin dorsal fin, tail and pectoral fin.',[d('dorsal',[13,1,22,8],2),d('tail',[1,7,9,20],2)]),
'shower': r('lathe',10,'Round shower rose over thin individual water streams, preserving the isolated droplets.',[d('water',[6,7,25,26],1)]),
'skateboard': r('box',2,'Thin deck with two rear truck assemblies and projecting wheels.',[d('left truck',[7,10,11,20],4),d('right truck',[22,10,26,20],4)]),
'skeleton-hat': r('round',8,'Rounded skull with a shallow blue cap brim and full crown.',[d('cap',[7,3,25,7],9)]),
'skilift': r('box',8,'Cable-car cabin with a thin hanger and cable; windows stay on the front.',[d('cable and hanger',[2,0,30,9],1),d('roof',[6,9,26,11],9)],'panels'),
'skis': r('box',2,'Pair of thin skis with shallow bindings, keeping the gap between them.'),
'smile': r('tube',4,'Shallow curved smile and lips with the open mouth cut through.'),
'snow-globe': r('round',16,'Round snow globe above a circular base; the miniature scene remains a front feature.',[d('base',[9,18,23,21],12,'lathe')],'plain','#9fc3e9'),
'snowboard': r('round',2,'Thin snowboard with rounded ends and front-only graphic.'),
'snowman': r('lathe',14,'Stacked round snowballs with a continuous scarf band, thin twig arms and a projecting carrot.',[d('arms',[4,8,28,15],2),d('carrot',[10,5,15,7],3)],'bands'),
'snowmobile': r('round',7,'Rounded snowmobile cowling with a thin windshield, skis and tracks.',[d('windshield',[12,3,18,10],1),d('skis',[3,18,31,22],1)]),
'snowpeak': r('lathe',16,'Conical forested mountain with a snowy summit and green lower slopes all round.',[],'bands'),
'spaghetti': r('lathe',12,'Rounded spaghetti mound and meatballs with separate one-voxel hanging noodles.',[d('hanging noodles',[5,13,26,25],1)],'bands'),
'sponge': r('box',6,'Soft squared sponge with pore texture on its reverse.',[],'spots'),
'squid': r('round',9,'Rounded squid mantle with thin side fins and narrow hanging tentacles.',[d('fins',[3,13,28,18],2),d('tentacles',[3,18,29,26],1)]),
'stapler': r('box',6,'Stapler with a rounded upper shell, thin metal jaw and full-width lower base.',[d('jaw',[8,14,25,17],3),d('upper shell',[5,8,25,13],6,'round')],'bands'),
'star-sparkles': r('disc',4,'Puffy shallow star with thin surrounding sparkles; detached sparks remain separate.'),
'steak': r('disc',4,'Thick steak cut with a fat rim and red meat on both faces.',[],'grain'),
'sunset': r('round',16,'Spherical sun with concentric colour shading restricted to the art face.'),
 'taco': r('round',6,'Folded taco shell with a shallow open top and raised lettuce and filling.',[d('filling',[6,4,27,10],3)],'spots'),
 'taxi': r('box',8,'Taxi with a narrower upper cabin, full lower body and shallow top sign.',[d('cabin',[9,6,24,13],6),d('roof sign',[14,2,21,6],2)],'panels'),
 'thumbs-up': r('round',7,'Sculpted padded hand with a narrower upright thumb and stepped curled fingers.',[d('thumb',[15,0,22,11],4,'round'),d('fingers',[21,10,29,21],6,'round')]),
 'toaster': r('box',7,'Toaster housing, shallow raised bread, side lever and thin power cord.',[d('toast',[7,4,24,10],2),d('cord',[2,20,7,29],1)],'panels'),
 'toiletpaper': r('tube',14,'Horizontal cylindrical paper roll with a narrow cardboard core and thin hanging paper tail.',[d('tail',[10,19,26,22],1)],'plain','#f4f4f4'),
 'tooth': r('round',8,'Rounded tooth crown with two narrower roots and shallow crown grooves.',[],'lobes'),
 'toothbrush': r('box',3,'Thin toothbrush handle with shallow bristle block and raised toothpaste ribbon.',[d('bristles',[7,11,24,16],3),d('paste',[8,7,24,11],2,'round')]),
 'tornado': r('lathe',14,'Twisting funnel with a wide rotating cloud cap and narrowing lower coils.',[],'bands'),
 'trashcan': r('lathe',14,'Round bin with vertical ribs, a separate shallow lid and thin carry handle.',[d('handle',[10,3,23,7],1),d('lid',[6,7,27,10],15,'lathe')],'lobes'),
 'treasure-chest': r('box',10,'Treasure chest with a curved lid, continuous metal bands and a plain rear hinge seam.',[d('lid',[6,6,26,13],10,'tube')],'plain'),
 'turing': r('box',4,'Thin computing grid panel with shallow surrounding wires and a plain backplate.',[d('left wire',[3,6,7,24],1),d('right wire',[25,6,29,24],1)],'panels'),
 'ufo': r('lathe',18,'Round flying saucer with a domed cockpit, continuous rim lights and thin antenna.',[d('antenna',[13,1,20,7],1),d('cockpit',[9,7,24,14],12,'lathe')],'bands'),
 'undead': r('round',7,'Rounded undead hand with thin separate fingers and a shallow exposed wrist.',[d('fingers',[7,0,28,12],3,'round')]),
 'unicorn': r('round',8,'Rounded unicorn skull with a thin horn, ears, mane and a projecting muzzle.',[d('horn',[18,2,29,10],1),d('mane',[4,2,13,22],3),d('muzzle',[13,15,27,21],8,'round')]),
 'vending-machine': r('box',9,'Vending cabinet with recessed display, dispensing recess and a ventilated rear panel.',[d('display',[9,5,23,16],8,'box',undefined,1)],'panels'),
 'vent': r('box',3,'Thin vent frame and open louvres; all gaps remain open.'),
 'void': r('box',1,'Exact isolated dotted outline. A connected solid head is impossible without adding visible support pixels.'),
 'volcano': r('lathe',16,'Conical volcanic mountain with a glowing crater collar and darker lower slopes.',[],'bands'),
 'volleyball': r('round',18,'Spherical volleyball with panel seams continuing around the ball.',[],'seams'),
 'wall-safe': r('box',9,'Deep wall safe with a recessed door, raised keypad and plain steel rear.',[d('door',[5,10,23,18],8,'box',undefined,1)],'panels'),
 'wall': r('box',4,'Brick wall with staggered mortar lines continuing over its sides and reverse.',[],'igloo'),
 'wallet': r('box',4,'Slim folded wallet with shallow protruding cards and a continuous fold seam.',[d('cards',[6,6,27,11],1)],'plain'),
 'washing-machine': r('box',10,'Washing machine cabinet with a recessed drum door and rear service panel.',[d('drum door',[10,10,24,20],9,'disc',undefined,1)],'panels'),
 'watch': r('box',4,'Shallow watch case with a raised bezel and thin side crown; face stays on the front.',[d('crown',[25,12,28,17],2)],'plain'),
 'watermelon': r('wedge',5,'Watermelon wedge with a thin green rind and seeded cut face.',[],'plain','#018146'),
 'wave': r('tube',6,'Curled wave with a thick lower body and shallow foamy crest.',[d('crest',[9,3,28,10],2)]),
 'weed': r('disc',1,'One-voxel leaf and stalk, retaining every serration and open gap.'),
 'weight': r('lathe',12,'Tapered weight body with a thin open carry handle and plain rear metal surface.',[d('handle',[10,3,23,8],1)]),
 'werewolf': r('round',8,'Rounded werewolf skull with shallow pointed ears and a continuous coloured headband.',[d('ears',[4,3,25,8],2),d('muzzle',[9,16,25,21],8,'round')],'bands'),
 'whale-alive': r('round',9,'Rounded blue whale body with shallow tail and flipper.',[d('tail',[1,10,10,21],2),d('flipper',[10,17,18,22],2)]),
 'whale': r('round',9,'Rounded whale profile with a narrower tail and fluted underside.',[d('tail',[3,15,11,23],3)],'grain'),
 'wine-barrel': r('lathe',18,'Bulging oak barrel with continuous iron hoops, circumferential staves, a wooden lid, narrow tap and single-voxel wine stream.',[d('tap',[25,11,27,12],1,'box','a',8),d('wine',[27,13,27,31],1,'box','e',8)],'staves','b'),
 'wine': r('lathe',16,'Rounded wine glass with a continuous liquid level and a narrow clear rim.',[],'bands'),
 'wizard-hat': r('lathe',12,'Bent conical wizard hat with a thin wide brim; star motifs remain on the front.',[d('brim',[7,19,28,21],14),d('bent tip',[7,2,14,7],3)],'plain','#2549fc'),
 'zebra': r('round',8,'Rounded zebra skull with a shallow striped mane, thin ears and projecting muzzle.',[d('mane',[3,3,7,21],2),d('ears',[14,1,23,7],2),d('muzzle',[19,16,28,21],8,'round')],'bands'),
};

// Material and component refinements after inspecting all seven views.
Object.assign(recipes['action-cam'], {material:'#30303a'});
Object.assign(recipes['calculator'], {material:'#cfc2ab'});
Object.assign(recipes['crt-bsod'], {material:'#cfc2ab'});
Object.assign(recipes['laptop'], {material:'#484d5c'});
Object.assign(recipes['microwave'], {material:'#adc8cc'});
Object.assign(recipes['vending-machine'], {material:'#f3322c'});
Object.assign(recipes['cordless-phone'], {material:'#cfc2ab'});
recipes['bigfoot'].details = [d('left arm',[1,8,9,16],3,'round'),d('right arm',[24,8,31,16],3,'round'),d('feet',[7,20,28,24],3)];
recipes['snowman'].details = [{...d('twig arms',[0,0,31,20],1),colors:['d']},d('carrot',[9,5,14,5],3)];
recipes['saturn'].details = [{...d('ring and orbital fragments',[0,0,31,31],1),colors:['b','c']}];
recipes['saturn'].pattern = 'bands';
recipes['firehydrant'].details = [d('left outlet',[4,12,8,17],5,'tube'),d('right outlet',[24,12,28,17],5,'tube')];
recipes['mug'].details = [d('handle',[0,9,4,17],1),d('steam',[0,0,31,7],1)];
recipes['toiletpaper'].shape = 'box';
recipes['toiletpaper'].depth = 12;
recipes['toiletpaper'].details = [d('hanging sheet',[9,20,26,23],1)];
recipes['wine'].material = 'a';

// Second visual pass: facial relief sits on a complete skull, rather than replacing
// it with a shallow slab or extruding a pale muzzle onto the back of the head.
const sculptedSkulls: Record<string, number> = {
  aardvark:12, ape:13, bat:11, bear:13, cat:12, chameleon:12, chicken:12,
  cow:13, crane:11, dino:12, dog:13, duck:13, frog:13,
  'horse-deep-fried':12, kangaroo:12, moose:13, mouse:12, orangutan:13,
  otter:12, panda:13, rabbit:12, raven:12, unicorn:13, werewolf:13, zebra:12,
};
for (const [name, depth] of Object.entries(sculptedSkulls)) {
  const recipe=recipes[name]; recipe.depth=depth;
  for (const detail of recipe.details??[]) if (/muzzle|jaw|snout|eyes/.test(detail.label)) {
    detail.surface=true; detail.depth=4; detail.at=0;
  }
}
// A face's eye/ear rectangles must not remove the whole forehead from skull bounds.
recipes.bear.bodyBounds=[8,8,23,21];
recipes.cat.bodyBounds=[7,9,25,21];
recipes.rabbit.bodyBounds=[9,12,22,21];
recipes.cow.bodyBounds=[8,8,23,20];
recipes.panda.bodyBounds=[8,8,23,20];
recipes.mouse.bodyBounds=[8,9,25,21];
recipes.frog.bodyBounds=[7,8,24,21];
recipes.owl.depth=12;
recipes.owl.material='a';
recipes.owl.bodyBounds=[7,3,23,20];
recipes.owl.details=[{...d('facial disc',[9,5,23,16],3,'round','c',1),surface:true},d('folded wing',[5,11,10,20],5,'round','a')];
recipes.owl.about='Rounded owl with a cream facial disc in front of a complete tawny skull and back, and a separate folded wing.';
recipes.bomb.depth=16;
recipes.bomb.bodyBounds=[7,9,25,22];
recipes.bomb.about='Spherical black bomb shell with a slender fuse and separate sparks.';
recipes.cow.pattern='plain'; // Random pink spots are not a cow coat.
recipes.cow.wrapColors=['b'];
recipes.orca.wrapColors=['b'];
recipes['whale-alive'].wrapColors=['c'];
recipes.fox.depth=10;
recipes.fox.bodyBounds=[9,10,26,21];
recipes.fox.details=[d('bushy tail',[4,4,12,18],7,'round','b'),d('head',[16,3,27,11],9,'round','b'),d('legs',[10,20,27,25],3,'round','b')];
recipes.fox.wrapColors=['a'];
recipes.fox.about='Whole fox with separate rounded head, full torso, bushy white-tipped tail and narrow legs; white fur continues around the form.';
recipes['toiletpaper'].shape='roll';
recipes['toiletpaper'].depth=14;
recipes['toiletpaper'].bodyBounds=[5,7,25,20];
recipes['toiletpaper'].about='Horizontal cylindrical paper roll with curved top and underside, a recessed cardboard core at both ends and a thin hanging sheet.';
// Side-view vehicles have glass and trim on both flanks, not a blank reverse.
recipes.car.wrapColors=['b','c','f'];
recipes.car.details=[d('cabin',[7,9,23,14],6,'round','a'),d('wheels',[6,18,26,21],8,'tube','e')];
recipes.helicopter.wrapColors=['b'];
recipes['console-handheld'].about='Handheld console with recessed screen, raised controls and a neutral rear battery hatch; display colours stay on the front.';
