# Generated by Django 3.2.15 on 2022-10-13 08:13

from django.db import migrations, models
import django.db.models.deletion
import kpi.fields.kpi_uid


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0042_add_metadata_permissions'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetMetadata',
            fields=[
                (
                    'id',
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('uid', kpi.fields.kpi_uid.KpiUidField(uid_prefix='am')),
                ('date_modified', models.DateTimeField()),
                ('settings', models.JSONField(default=dict)),
                (
                    'asset',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='asset_metadata',
                        to='kpi.asset',
                    ),
                ),
            ],
            options={
                'ordering': ['-date_modified'],
            },
        ),
    ]
