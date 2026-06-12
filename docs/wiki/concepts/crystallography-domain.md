# Crystallography Domain (晶体学领域)

**中文名称**: 晶体学

## Overview

Crystallography is the experimental science of determining the arrangement of atoms in crystalline solids.

## Core Concepts

### Crystal Structure

A crystal structure is defined by:

1. **Unit Cell** (晶胞)
   - Smallest repeating unit
   - Defined by 6 parameters: a, b, c, α, β, γ

2. **Space Group** (空间群)
   - Symmetry operations that map the crystal onto itself
   - 230 unique space groups in 3D
   - Described by Hermann-Mauguin notation (e.g., `P 1 21/c 1`)

3. **Atomic Positions** (原子位置)
   - Fractional coordinates (x, y, z)
   - One coordinate per unique atom
   - Symmetry generates equivalent positions

### Unit Cell Parameters

| Parameter | Symbol | Description | CIF Tag |
|-----------|--------|-------------|---------|
| Length a | a | Cell edge length | `_cell_length_a` |
| Length b | b | Cell edge length | `_cell_length_b` |
| Length c | c | Cell edge length | `_cell_length_c` |
| Angle α | α | Angle between b and c | `_cell_angle_alpha` |
| Angle β | β | Angle between a and c | `_cell_angle_beta` |
| Angle γ | γ | Angle between a and b | `_cell_angle_gamma` |
| Volume | V | Cell volume | `_cell_volume` |

### Symmetry Operations

Space group symmetry operations generate all atoms in the unit cell:

```
_symmetry_equiv_pos_as_xyz
'x, y, z'
'-x, -y, -z'
'-x+1/2, y, -z+1/2'
```

## Crystal Structure Determination

### X-ray Diffraction

1. **Data Collection**
   - Measure diffraction intensities
   - Record reflection positions (h, k, l)
   - Collect at various temperatures

2. **Structure Solution**
   - Direct methods
   - Patterson methods
   - Charge flipping

3. **Structure Refinement**
   - Least-squares refinement
   - R-factors (R1, wR2)
   - Displacement parameters (U, B)

### CIF Data for Crystallography

### Chemical Information

```
_chemical_formula_sum          'C6 H12 O6'
_chemical_formula_weight       180.16
_chemical_name_systematic     'D-Glucose'
```

### Crystal Data

```
_crystal_density_diffrn        1.56
_crystal_density_meas          1.55
_crystal_colour               'colorless'
_crystal_size_max             0.25
_crystal_size_mid             0.20
_crystal_size_min             0.15
```

### Diffraction Data

```
_diffrn_radiation_wavelength  1.5418
_diffrn_radiation_type        'CuKα'
_diffrn_reflns_number         2543
_diffrn_reflns_av_R_equivalents  0.035
```

### Refinement Data

```
_refine_ls_number_reflns      2543
_refine_ls_number_parameters  217
_refine_ls_R_factor_gt        0.045
_refine_ls_wR_factor_ref      0.123
_refine_ls_goodness_of_fit    1.05
```

## Atomic Position Data

### Fractional Coordinates

```
_atom_site_label  C1
_atom_site_type_symbol  C
_atom_site_fract_x  0.1234
_atom_site_fract_y  0.5678
_atom_site_fract_z  0.9012
_atom_site_occupancy  1.0
_atom_site_U_iso_or_equiv  0.023
```

### Anisotropic Displacement

```
_atom_site_aniso_label  C1
_atom_site_aniso_U_11   0.023
_atom_site_aniso_U_22   0.015
_atom_site_aniso_U_33   0.018
_atom_site_aniso_U_12   0.002
_atom_site_aniso_U_13   0.001
_atom_site_aniso_U_23   0.003
```

## Common Crystal Systems

| System | Constraints | Common Space Groups |
|--------|-------------|---------------------|
| Triclinic | a≠b≠c, α≠β≠γ≠90° | P1, P-1 |
| Monoclinic | a≠b≠c, α=γ=90°, β≠90° | P2₁/c, C2/c |
| Orthorhombic | a≠b≠c, α=β=γ=90° | Pnma, Pbca |
| Tetragonal | a=b≠c, α=β=γ=90° | P4₁, I4₁/amd |
| Trigonal | a=b=c, α=β=γ<120°, ≠90° | R3, R-3 |
| Hexagonal | a=b≠c, α=β=90°, γ=120° | P6₃, P6₃/mmc |
| Cubic | a=b=c, α=β=γ=90° | Fm-3m, Pn-3m |

## Related Concepts

- [CIF File Format](./cif-file-format.md)
- [CIF Dictionary](./cif-dictionary.md)
- [CIF Tag](../entities/cif-tag.md)
