"""Import a Rocketbox facial FBX and export a self-contained GLB.

Run through the pinned local Blender container:
docker run --rm -v "$PWD:/work" -w /work --entrypoint blender \
  ghcr.io/linuxserver/blender:arm64v8-5.2.1-ls237 -b --python \
  tools/convert-rocketbox.py -- source.fbx output.glb
"""
import bpy
import os
import sys


def args_after_separator():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


args = args_after_separator()
if not args:
    raise SystemExit('Expected: source.fbx output.glb [--inspect]')

source = os.path.abspath(args[0])
inspect_only = '--inspect' in args
output = os.path.abspath(args[1]) if len(args) > 1 and args[1] != '--inspect' else None

bpy.ops.wm.read_factory_settings(use_empty=True)
# Blender 5's bundled FBX importer intentionally exposes a lean surface.
# The source has textures beside the FBX, so its default resolution is enough.
bpy.ops.import_scene.fbx(filepath=source)

# TalkingHead resolves the root skeleton by this conventional object name. The
# Rocketbox bone hierarchy itself stays intact; only its exported root object
# changes from Bip01 to Armature.
for obj in bpy.context.scene.objects:
    if obj.type == 'ARMATURE':
        obj.name = 'Armature'
        obj.data.name = 'Armature'
        bone_names = {
            'Bip01 Pelvis': 'Hips', 'Bip01 Spine': 'Spine', 'Bip01 Spine1': 'Spine1', 'Bip01 Spine2': 'Spine2',
            'Bip01 Neck': 'Neck', 'Bip01 Head': 'Head', 'Bip01 LEye': 'LeftEye', 'Bip01 REye': 'RightEye',
            'Bip01 L Clavicle': 'LeftShoulder', 'Bip01 L UpperArm': 'LeftArm', 'Bip01 L Forearm': 'LeftForeArm', 'Bip01 L Hand': 'LeftHand',
            'Bip01 R Clavicle': 'RightShoulder', 'Bip01 R UpperArm': 'RightArm', 'Bip01 R Forearm': 'RightForeArm', 'Bip01 R Hand': 'RightHand',
            'Bip01 L Thigh': 'LeftUpLeg', 'Bip01 L Calf': 'LeftLeg', 'Bip01 L Foot': 'LeftFoot', 'Bip01 L Toe0': 'LeftToeBase',
            'Bip01 R Thigh': 'RightUpLeg', 'Bip01 R Calf': 'RightLeg', 'Bip01 R Foot': 'RightFoot', 'Bip01 R Toe0': 'RightToeBase',
        }
        for side, prefix in [('L', 'LeftHand'), ('R', 'RightHand')]:
            for digit, label in [('0', 'Thumb'), ('1', 'Index'), ('2', 'Middle'), ('3', 'Ring'), ('4', 'Pinky')]:
                bone_names[f'Bip01 {side} Finger{digit}'] = f'{prefix}{label}1'
                bone_names[f'Bip01 {side} Finger{digit}1'] = f'{prefix}{label}2'
                bone_names[f'Bip01 {side} Finger{digit}2'] = f'{prefix}{label}3'
        for original, normalized in bone_names.items():
            bone = obj.data.bones.get(original)
            if bone:
                bone.name = normalized
        # Rocketbox uses three finger joints while TalkingHead's standard
        # skeleton declares four. Add unweighted terminal bones to complete
        # that contract without changing any skinned deformation.
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for side in ('LeftHand', 'RightHand'):
            for digit in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
                parent = obj.data.edit_bones.get(f'{side}{digit}3')
                if not parent:
                    continue
                tip = obj.data.edit_bones.new(f'{side}{digit}4')
                tip.head = parent.tail
                tip.tail = parent.tail + (parent.tail - parent.head) * .7
                tip.parent = parent
                tip.use_connect = True
        bpy.ops.object.mode_set(mode='OBJECT')
        # FBX import keeps the source's centimetre scale and 90° axis turn on
        # the root. Bake those once so TalkingHead's portrait camera sees the
        # same real-world scale as its native GLB examples.
        bpy.ops.object.select_all(action='SELECT')
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        # FBX roots can retain their import transform despite transform_apply
        # because the skeleton owns a bind-pose matrix. TalkingHead's loader
        # expects a neutral root transform, so write it explicitly.
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
        obj.scale = (1, 1, 1)
        break

# Rocketbox FBXs retain the original artist's absolute Windows texture paths.
# Resolve each image by basename beside the checked-out avatar, then pack it so
# the output GLB is self-contained at runtime.
texture_dir = os.path.join(os.path.dirname(os.path.dirname(source)), 'Textures')
for image in bpy.data.images:
    candidate = os.path.join(texture_dir, os.path.basename(image.filepath))
    if os.path.isfile(candidate):
        image.filepath = candidate
        image.reload()
        image.pack()

meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
# TalkingHead discovers the skinned character mesh by this conventional name.
# Rocketbox keeps the whole character in one skinned mesh, so this rename is
# enough; it does not merge or alter any geometry.
if meshes:
    meshes[0].name = 'Wolf3D_Avatar'
    meshes[0].data.name = 'Wolf3D_Avatar'
print(f'Imported {len(meshes)} meshes from {os.path.basename(source)}')
for mesh in meshes:
    keys = mesh.data.shape_keys
    names = [key.name for key in keys.key_blocks] if keys else []
    if names:
        print(f'SHAPE_KEYS {mesh.name} ({len(names)}): ' + ' | '.join(names))
for image in bpy.data.images:
    print(f'IMAGE {image.name}: {image.filepath}')

if inspect_only:
    raise SystemExit(0)
if not output:
    raise SystemExit('An output .glb path is required.')

# Rocketbox ships the canonical ARKit 52 set as e.g. AK_25_JawOpen. Preserve
# its geometry, but normalize the exported target labels to the lower-camel
# spelling emitted by MediaPipe and consumed by AvatarController.
for mesh in meshes:
    keys = mesh.data.shape_keys
    if not keys:
        continue
    for key in keys.key_blocks:
        if not key.name.startswith('AK_'):
            continue
        parts = key.name.split('_', 2)
        if len(parts) == 3:
            target = parts[2]
            key.name = target[0].lower() + target[1:]

for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0] if meshes else None
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format='GLB',
    export_image_format='AUTO',
    export_materials='EXPORT',
    export_animations=False,
    export_morph=True,
    export_morph_normal=True,
    export_morph_tangent=True,
    export_skins=True,
    export_yup=True,
)
print(f'Exported {output}')
